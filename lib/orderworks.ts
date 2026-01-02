import crypto from 'crypto'

import { prisma } from '@/lib/db'
import type { CheckoutLineItem, ShippingSelection } from '@/types/checkout'
import { buildAbsoluteUrl } from '@/lib/slicer'
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
  description: string
  label: string
  title: string
  name: string
  summary: string
  quantity: number
  qty: number
  unitPriceCents: number
  unitPrice?: number
  lineTotalCents: number
  lineTotal?: number
  material: string
  color?: string
  colors: string[]
  scale: number
  notes: string
  storagePath: string
  storageUrl: string
  downloadUrl: string
  files: OrderWorksFilePointer[]
  metadata?: Record<string, string | number | null>
}

type OrderWorksFilePointer = {
  label: string
  storagePath: string
  storageUrl: string
  downloadUrl: string
}

type PartFileRecord = {
  id: string
  modelId: string
  filePath: string | null
  previewFilePath: string | null
}

type ModelFileRecord = {
  id: string
  filePath: string | null
  viewerFilePath: string | null
}

type OrderWorksRetryFailure = {
  jobId: string
  message: string
}

function readEnv(key: string): string | undefined {
  if (typeof process === 'undefined') return undefined
  const value = process.env?.[key]
  return typeof value === 'string' ? value : undefined
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
  const raw = readEnv('ORDERWORKS_ADDITIONAL_WEBHOOKS') || readEnv('ORDERWORKS_EXTRA_WEBHOOKS')
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

function buildPrimaryTarget(): WebhookTarget[] {
  const url = readEnv('ORDERWORKS_WEBHOOK_URL')
  if (!url) return []
  return [
    {
      url,
      secret: readEnv('ORDERWORKS_WEBHOOK_SECRET') || undefined,
      label: 'orderworks',
    },
  ]
}

function getWebhookTargets(): WebhookTarget[] {
  return [...buildPrimaryTarget(), ...parseAdditionalTargets()]
}

function sanitizeStoragePathValue(path?: string | null) {
  if (!path) return null
  const trimmed = String(path).trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/\\/g, '/').replace(/\/{2,}/g, '/')
  if (!normalized) return null
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

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
  const storagePath = sanitizeStoragePathValue(item.storagePath)
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
  }
}

function extractFilePointers(items: StoredLineItem[]): FilePointer[] {
  return items
    .map((item) => buildFilePointerForItem(item))
    .filter((ptr): ptr is FilePointer => Boolean(ptr))
}

async function hydrateLineItemFiles(items: StoredLineItem[]): Promise<StoredLineItem[]> {
  const missing = items.filter((item) => !item?.storagePath && !item?.storageUrl && (item?.modelId || item?.partId))
  if (missing.length === 0) return items
  const partIds = Array.from(new Set(missing.map((item) => item.partId).filter((val): val is string => typeof val === 'string' && val.length > 0)))
  const modelIds = Array.from(new Set(missing.map((item) => item.modelId).filter((val): val is string => typeof val === 'string' && val.length > 0)))
  const [parts, models] = await Promise.all([
    partIds.length > 0
      ? prisma.modelPart.findMany({
          where: { id: { in: partIds } },
          select: { id: true, modelId: true, filePath: true, previewFilePath: true },
        })
      : Promise.resolve([] as PartFileRecord[]),
    modelIds.length > 0
      ? prisma.model.findMany({
          where: { id: { in: modelIds } },
          select: { id: true, filePath: true, viewerFilePath: true },
        })
      : Promise.resolve([] as ModelFileRecord[]),
  ])
  const partMap = new Map<string, PartFileRecord>(parts.map((part) => [part.id, part]))
  const modelMap = new Map<string, ModelFileRecord>(models.map((model) => [model.id, model]))

  const findFallbackPath = (item: StoredLineItem): string | null => {
    if (item.partId && partMap.has(item.partId)) {
      const part = partMap.get(item.partId)!
      const partPath = sanitizeStoragePathValue(part.filePath) || sanitizeStoragePathValue(part.previewFilePath)
      if (partPath) return partPath
      if (part.modelId && modelMap.has(part.modelId)) {
        const parent = modelMap.get(part.modelId)!
        const parentPath = sanitizeStoragePathValue(parent.filePath) || sanitizeStoragePathValue(parent.viewerFilePath)
        if (parentPath) return parentPath
      }
    }
    if (item.modelId && modelMap.has(item.modelId)) {
      const model = modelMap.get(item.modelId)!
      return sanitizeStoragePathValue(model.filePath) || sanitizeStoragePathValue(model.viewerFilePath)
    }
    return null
  }

  return items.map((item) => {
    if (item.storagePath || item.storageUrl) return item
    const fallbackPath = findFallbackPath(item)
    if (!fallbackPath) return item
    return {
      ...item,
      storagePath: fallbackPath,
    }
  })
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
    const rawUnitPrice = typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) ? Number(item.unitPrice) : undefined
    const rawLineTotal = typeof item.lineTotal === 'number' && Number.isFinite(item.lineTotal) ? Number(item.lineTotal) : undefined
    const unitPrice = rawUnitPrice != null ? Number(rawUnitPrice.toFixed(2)) : rawLineTotal != null ? Number((rawLineTotal / qty).toFixed(2)) : undefined
    const lineTotal = rawLineTotal != null ? Number(rawLineTotal.toFixed(2)) : unitPrice != null ? Number((unitPrice * qty).toFixed(2)) : undefined
    const derivedUnitPrice = unitPrice ?? (lineTotal != null ? lineTotal / qty : undefined)
    const unitPriceCents = derivedUnitPrice != null ? Math.max(0, Math.round(derivedUnitPrice * 100)) : 0
    const lineTotalCents = lineTotal != null ? Math.max(0, Math.round(lineTotal * 100)) : unitPriceCents * qty
    const pointer = buildFilePointerForItem(item)
    const storagePath = toSafeString(pointer?.storagePath ?? item.storagePath ?? null, '')
    const storageUrl = toSafeString(pointer?.storageUrl ?? item.storageUrl ?? null, '')
    const downloadUrl = toSafeString(pointer?.downloadUrl ?? null, storageUrl)
    const material = toSafeString(item.material, 'PLA')
    const modelId = toSafeString(item.modelId, `item-${idx + 1}`)
    const partId = toSafeString(item.partId ?? null, '')
    const partName = toSafeString(item.partName ?? null, '')
    const notes = toSafeString(item.customText ?? null, '')
    const colors = Array.isArray(item.colors)
      ? item.colors.filter((color) => typeof color === 'string' && color.trim().length > 0).map((color) => color.trim())
      : []
    const files: OrderWorksFilePointer[] = storagePath || storageUrl || downloadUrl
      ? [
          {
            label: toSafeString(pointer?.label ?? null, title),
            storagePath,
            storageUrl,
            downloadUrl,
          },
        ]
      : []
    const lineItemId = toSafeString(item.partId || item.modelId || null, `item-${idx + 1}`)
    return {
      id: lineItemId,
      modelId,
      partId,
      partName,
      description: summary,
      label: title,
      title,
      name: title,
      summary,
      quantity: qty,
      qty,
      unitPrice,
      unitPriceCents,
      lineTotal,
      lineTotalCents,
      material,
      color: colors[0],
      colors,
      scale: typeof item.scale === 'number' && Number.isFinite(item.scale) && item.scale > 0 ? Number(item.scale) : 1,
      notes,
      storagePath,
      storageUrl,
      downloadUrl,
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
  try {
    await queueOrderWorksJob(job.id)
  } catch (err) {
    console.error('OrderWorks webhook error:', err)
    throw err
  }
  return job
}

async function sendJobToOrderWorks(jobId: string, targets: WebhookTarget[] = getWebhookTargets()) {
  if (targets.length === 0) {
    console.warn('No OrderWorks webhook targets configured; skipping sync.')
    return
  }
  const job = await prisma.jobForm.findUnique({ where: { id: jobId } })
  if (!job) return
  const storedLineItems = coerceLineItems(job.lineItems)
  const hydratedLineItems = await hydrateLineItemFiles(storedLineItems)
  const lineItemSummaries = buildLineItemSummaries(hydratedLineItems, job.currency || 'USD')
  const orderWorksLineItems = buildOrderWorksLineItems(hydratedLineItems, lineItemSummaries, job.currency || 'USD')
  const files = extractFilePointers(hydratedLineItems)
  const payload = {
    id: job.id,
    paymentIntentId: job.paymentIntentId,
    totalCents: job.totalCents,
    currency: job.currency,
    lineItems: orderWorksLineItems,
    lineItemSummaries,
    makerworksLineItems: hydratedLineItems,
    files,
    shipping: job.shipping,
    metadata: job.metadata,
    userId: job.userId,
    customerEmail: job.customerEmail,
    createdAt: job.createdAt,
  }
  const errors: string[] = []
  const jsonBody = JSON.stringify(payload)
  for (const target of targets) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const bodyToSend: BodyInit = jsonBody
      const bodyForSignature = jsonBody
      if (target.secret) {
        const signature = buildMakerWorksSignature(target.secret, bodyForSignature)
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
        body: bodyToSend,
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
  await sendJobToOrderWorks(jobId)
}

export async function retryPendingOrderWorksJobs(limit = 10) {
  const targets = getWebhookTargets()
  if (targets.length === 0) {
    const error: any = new Error('ORDERWORKS_WEBHOOK_URL is not configured; cannot retry jobs.')
    error.code = 'ORDERWORKS_CONFIG_MISSING'
    error.status = 400
    throw error
  }
  const jobs = await prisma.jobForm.findMany({
    where: { status: 'pending' },
    orderBy: [{ lastAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  })
  let processed = 0
  const failures: OrderWorksRetryFailure[] = []
  for (const job of jobs) {
    try {
      await sendJobToOrderWorks(job.id, targets)
      processed++
    } catch (err) {
      console.error('Failed OrderWorks retry', err)
      failures.push({
        jobId: job.id,
        message: (err as Error)?.message ? String((err as Error).message).slice(0, 500) : 'Unknown error',
      })
    }
  }
  const remaining = await prisma.jobForm.count({ where: { status: 'pending' } })
  if (failures.length > 0) {
    const error: any = new Error(`Failed to resend ${failures.length} job${failures.length === 1 ? '' : 's'}.`)
    error.code = 'ORDERWORKS_RETRY_FAILED'
    error.status = 502
    error.failures = failures
    error.processed = processed
    error.remaining = remaining
    throw error
  }
  return { processed, remaining }
}
