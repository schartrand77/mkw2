import crypto from 'crypto'

import { prisma } from '@/lib/db'
import type { CheckoutLineItem, ShippingSelection } from '@/types/checkout'
import { buildAbsoluteUrl, buildBambuStudioUrl } from '@/lib/slicer'
import type { FulfillmentStatus } from '@prisma/client'

type JobStatus = 'pending' | 'sent'

export type JobFormInput = {
  paymentIntentId: string
  amountCents: number
  currency: string
  lineItems: CheckoutLineItem[]
  shipping?: ShippingSelection
  userId?: string | null
  customerEmail?: string | null
  metadata?: Record<string, any>
  paymentMethod?: string | null
  paymentStatus?: string | null
  fulfillmentStatus?: FulfillmentStatus | null
  fulfilledAt?: Date | null
}

type StoredLineItem = CheckoutLineItem & {
  storagePath?: string | null
  storageUrl?: string | null
}

type FilePointer = {
  label: string
  modelId?: string
  partId?: string
  storagePath?: string | null
  storageUrl?: string | null
  downloadUrl?: string | null
  bambuStudioUrl?: string | null
}

type WebhookTarget = {
  url: string
  secret?: string
  label: string
}

type MakerWorksSignature = {
  timestamp: number
  bodyDigest: string
  timestampDigest: string
}

type OrderWorksLineItem = {
  id: string
  modelId: string
  partId: string
  partName: string
  label: string
  title: string
  name: string
  summary: string
  quantity: number
  qty: number
  unitPriceCents?: number
  unitPrice?: number
  lineTotalCents?: number
  lineTotal?: number
  material: string
  colors: string[]
  scale: number
  notes: string
  storagePath: string
  storageUrl: string
  downloadUrl: string
  bambuStudioUrl: string
  files: OrderWorksFilePointer[]
  metadata?: Record<string, string | number | null>
}

type OrderWorksFilePointer = {
  label: string
  storagePath: string
  storageUrl: string
  downloadUrl: string
  bambuStudioUrl: string
}

function buildMakerWorksSignature(secret: string, body: string): MakerWorksSignature {
  const timestamp = Math.floor(Date.now() / 1000)
  const canonicalPayload = `${timestamp}.${body}`
  const bodyDigest = crypto.createHmac('sha256', secret).update(body).digest('hex')
  const timestampDigest = crypto.createHmac('sha256', secret).update(canonicalPayload).digest('hex')
  return {
    timestamp,
    bodyDigest,
    timestampDigest,
  }
}

function parseAdditionalTargets(): WebhookTarget[] {
  const raw = process.env.ORDERWORKS_ADDITIONAL_WEBHOOKS || process.env.ORDERWORKS_EXTRA_WEBHOOKS
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry, idx) => {
          if (!entry) return null
          if (typeof entry === 'string') return { url: entry, label: `extra-${idx + 1}` }
          if (typeof entry === 'object') {
            const url = typeof entry.url === 'string' ? entry.url : typeof entry.href === 'string' ? entry.href : null
            if (!url) return null
            return {
              url,
              secret: typeof entry.secret === 'string' ? entry.secret : undefined,
              label: typeof entry.label === 'string' ? entry.label : typeof entry.name === 'string' ? entry.name : `extra-${idx + 1}`,
            }
          }
          return null
        })
        .filter((item): item is WebhookTarget => Boolean(item?.url))
    }
  } catch {
    // Fallback to comma-separated entries like url|secret,url2
    return raw
      .split(',')
      .map((entry, idx) => entry.trim())
      .filter(Boolean)
      .map((entry, idx) => {
        const [url, secret] = entry.split('|').map((part) => part.trim())
        return { url, secret: secret || undefined, label: `extra-${idx + 1}` }
      })
      .filter((item) => Boolean(item.url))
  }
  return []
}

const PRIMARY_TARGET = process.env.ORDERWORKS_WEBHOOK_URL
  ? [{ url: process.env.ORDERWORKS_WEBHOOK_URL, secret: process.env.ORDERWORKS_WEBHOOK_SECRET || undefined, label: 'orderworks' }]
  : []

const WEBHOOK_TARGETS: WebhookTarget[] = [...PRIMARY_TARGET, ...parseAdditionalTargets()]

function toSafeString(value: string | null | undefined, fallback = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : fallback
  }
  if (value === null || value === undefined) return fallback
  const stringified = String(value)
  return stringified.length > 0 ? stringified : fallback
}

function coerceLineItems(raw: unknown): StoredLineItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (item && typeof item === 'object') return item as StoredLineItem
      return null
    })
    .filter((item): item is StoredLineItem => !!item)
}

function buildFilePointerForItem(item: StoredLineItem): FilePointer | null {
  const storagePath = item.storagePath || null
  const storageUrl = item.storageUrl || null
  if (!storagePath && !storageUrl) return null
  const fileRoute = storagePath ? buildFilesRoute(storagePath) : null
  const downloadUrl = storageUrl || (fileRoute ? buildAbsoluteUrl(fileRoute) : null)
  return {
    label: item.title || item.modelId || 'Item',
    modelId: item.modelId,
    partId: item.partId || undefined,
    storagePath,
    storageUrl,
    downloadUrl,
    bambuStudioUrl: buildBambuStudioUrl(downloadUrl || undefined),
  }
}

function extractFilePointers(items: StoredLineItem[]): FilePointer[] {
  return items
    .map((item) => buildFilePointerForItem(item))
    .filter((ptr): ptr is FilePointer => Boolean(ptr))
}

function buildLineItemSummaries(items: StoredLineItem[], currency: string): string[] {
  if (items.length === 0) return []
  const safeCurrency = currency?.toUpperCase() || 'USD'
  return items.map((item) => {
    const qty = typeof item.qty === 'number' && Number.isFinite(item.qty) && item.qty > 0 ? item.qty : 1
    const title = item.title || item.modelId || 'Item'
    const part = item.partName ? ` (${item.partName})` : ''
    const segments = [`${qty}x ${title}${part}`]
    if (item.material) segments.push(`material ${item.material}`)
    if (Array.isArray(item.colors) && item.colors.length > 0) {
      segments.push(`colors: ${item.colors.filter((c) => typeof c === 'string' && c.trim().length > 0).join(', ')}`)
    }
    if (typeof item.scale === 'number' && Number.isFinite(item.scale) && item.scale !== 1) {
      segments.push(`scale ${Number(item.scale.toFixed(2))}x`)
    }
    if (typeof item.lineTotal === 'number' && Number.isFinite(item.lineTotal)) {
      segments.push(`${safeCurrency} ${item.lineTotal.toFixed(2)}`)
    }
    if (item.customText) segments.push(`notes: ${item.customText}`)
    return segments.join(' | ')
  })
}

function buildOrderWorksLineItems(items: StoredLineItem[], summaries: string[], currency: string): OrderWorksLineItem[] {
  const safeCurrency = currency?.toUpperCase() || 'USD'
  return items.map((item, idx) => {
    const qty = typeof item.qty === 'number' && Number.isFinite(item.qty) && item.qty > 0 ? item.qty : 1
    const title = toSafeString(item.title || item.modelId, `Item ${idx + 1}`)
    const summary = summaries[idx] || `${qty}x ${title}`
    const unitPrice = typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) ? Number(item.unitPrice.toFixed(2)) : undefined
    const lineTotal = typeof item.lineTotal === 'number' && Number.isFinite(item.lineTotal) ? Number(item.lineTotal.toFixed(2)) : undefined
    const pointer = buildFilePointerForItem(item)
    const storagePath = toSafeString(pointer?.storagePath ?? item.storagePath ?? null, '')
    const storageUrl = toSafeString(pointer?.storageUrl ?? item.storageUrl ?? null, '')
    const downloadUrl = toSafeString(pointer?.downloadUrl ?? null, storageUrl)
    const bambuStudioUrl = toSafeString(pointer?.bambuStudioUrl ?? null, '')
    const material = toSafeString(item.material, 'PLA')
    const modelId = toSafeString(item.modelId, `item-${idx + 1}`)
    const partId = toSafeString(item.partId ?? null, '')
    const partName = toSafeString(item.partName ?? null, '')
    const notes = toSafeString(item.customText ?? null, '')
    const colors = Array.isArray(item.colors)
      ? item.colors.filter((color) => typeof color === 'string' && color.trim().length > 0).map((color) => color.trim())
      : []
    const files: OrderWorksFilePointer[] = storagePath || storageUrl || downloadUrl || bambuStudioUrl
      ? [
          {
            label: toSafeString(pointer?.label ?? null, title),
            storagePath,
            storageUrl,
            downloadUrl,
            bambuStudioUrl,
          },
        ]
      : []
    const lineItemId = toSafeString(item.partId || item.modelId || null, `item-${idx + 1}`)
    return {
      id: lineItemId,
      modelId,
      partId,
      partName,
      label: title,
      title,
      name: title,
      summary,
      quantity: qty,
      qty,
      unitPrice,
      unitPriceCents: unitPrice != null ? Math.round(unitPrice * 100) : undefined,
      lineTotal,
      lineTotalCents: lineTotal != null ? Math.round(lineTotal * 100) : undefined,
      material,
      colors,
      scale: typeof item.scale === 'number' && Number.isFinite(item.scale) && item.scale > 0 ? Number(item.scale) : 1,
      notes,
      storagePath,
      storageUrl,
      downloadUrl,
      bambuStudioUrl,
      files,
      metadata: {
        modelId,
        partId: partId || null,
        partName: partName || null,
        summary,
        currency: safeCurrency,
      },
    }
  })
}

function buildFilesRoute(storagePath: string) {
  const normalized = storagePath.startsWith('/') ? storagePath : `/${storagePath}`
  return `/files${normalized}`.replace(/\/{2,}/g, '/')
}

export async function recordOrderWorksJob({
  paymentIntentId,
  amountCents,
  currency,
  lineItems,
  shipping,
  userId,
  customerEmail,
  metadata,
  paymentMethod,
  paymentStatus,
  fulfillmentStatus,
  fulfilledAt,
}: JobFormInput) {
  const safeCurrency = currency.toUpperCase()
  const job = await prisma.jobForm.upsert({
    where: { paymentIntentId },
    create: {
      paymentIntentId,
      userId: userId || null,
      customerEmail: customerEmail || null,
      totalCents: amountCents,
      currency: safeCurrency,
      lineItems,
      shipping: shipping ?? undefined,
      metadata: metadata ?? undefined,
      status: 'pending',
      paymentMethod: paymentMethod ?? undefined,
      paymentStatus: paymentStatus ?? undefined,
      fulfillmentStatus: fulfillmentStatus ?? undefined,
      fulfilledAt: fulfilledAt ?? undefined,
    },
    update: {
      userId: userId || null,
      customerEmail: customerEmail || null,
      totalCents: amountCents,
      currency: safeCurrency,
      lineItems,
      shipping: shipping ?? undefined,
      metadata: metadata ?? undefined,
      status: 'pending' as JobStatus,
      paymentMethod: paymentMethod ?? undefined,
      paymentStatus: paymentStatus ?? undefined,
      fulfillmentStatus: fulfillmentStatus ?? undefined,
      fulfilledAt: fulfilledAt ?? undefined,
    },
  })
  queueOrderWorksJob(job.id).catch((err) => {
    console.error('OrderWorks webhook error:', err)
  })
  return job
}

async function sendJobToOrderWorks(jobId: string) {
  if (WEBHOOK_TARGETS.length === 0) {
    console.warn('No OrderWorks webhook targets configured; skipping sync.')
    return
  }
  const job = await prisma.jobForm.findUnique({ where: { id: jobId } })
  if (!job) return
  const storedLineItems = coerceLineItems(job.lineItems)
  const lineItemSummaries = buildLineItemSummaries(storedLineItems, job.currency || 'USD')
  const orderWorksLineItems = buildOrderWorksLineItems(storedLineItems, lineItemSummaries, job.currency || 'USD')
  const files = extractFilePointers(storedLineItems)
  const payload = {
    id: job.id,
    paymentIntentId: job.paymentIntentId,
    totalCents: job.totalCents,
    currency: job.currency,
    lineItems: orderWorksLineItems,
    makerworksLineItems: storedLineItems,
    lineItemSummaries,
    files,
    shipping: job.shipping,
    metadata: job.metadata,
    userId: job.userId,
    customerEmail: job.customerEmail,
    createdAt: job.createdAt,
  }
  const errors: string[] = []
  const body = JSON.stringify(payload)
  for (const target of WEBHOOK_TARGETS) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (target.secret) {
        const signature = buildMakerWorksSignature(target.secret, body)
        headers.Authorization = `Bearer ${target.secret}`
        headers['X-MakerWorks-Signature'] = `sha256=${signature.bodyDigest}`
        headers['MakerWorks-Signature'] = `sha256=${signature.bodyDigest}`
        headers['X-MakerWorks-Signature-V1'] = `t=${signature.timestamp},v1=${signature.timestampDigest}`
        headers['MakerWorks-Signature-V1'] = `t=${signature.timestamp},v1=${signature.timestampDigest}`
        headers['X-MakerWorks-Timestamp'] = String(signature.timestamp)
        headers['X-Hub-Signature-256'] = `sha256=${signature.bodyDigest}`
      }
      const response = await fetch(target.url, {
        method: 'POST',
        headers,
        body,
      })
      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        errors.push(`${target.label} responded ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`.trim())
      }
    } catch (err: any) {
      errors.push(`${target.label} error: ${err?.message || String(err)}`)
    }
  }
  const success = errors.length === 0
  await prisma.jobForm.update({
    where: { id: job.id },
    data: {
      status: success ? 'sent' : 'pending',
      webhookAttempts: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: success ? null : errors.join(' | ').slice(0, 500),
    },
  })
  if (!success) {
    throw new Error(`OrderWorks webhook failures: ${errors.join('; ')}`)
  }
}

export async function queueOrderWorksJob(jobId: string) {
  if (WEBHOOK_TARGETS.length === 0) return
  await sendJobToOrderWorks(jobId)
}

export async function retryPendingOrderWorksJobs(limit = 10) {
  if (WEBHOOK_TARGETS.length === 0) return { processed: 0, message: 'Webhook targets missing' }
  const jobs = await prisma.jobForm.findMany({
    where: { status: 'pending' },
    orderBy: [{ lastAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  })
  let processed = 0
  for (const job of jobs) {
    try {
      await sendJobToOrderWorks(job.id)
      processed++
    } catch (err) {
      console.error('Failed OrderWorks retry', err)
    }
  }
  return { processed, remaining: Math.max(0, (await prisma.jobForm.count({ where: { status: 'pending' } })) - processed) }
}
