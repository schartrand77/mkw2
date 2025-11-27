import { prisma } from '@/lib/db'
import type { CheckoutLineItem, ShippingSelection } from '@/types/checkout'

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
}

type WebhookTarget = {
  url: string
  secret?: string
  label: string
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

export async function recordOrderWorksJob({
  paymentIntentId,
  amountCents,
  currency,
  lineItems,
  shipping,
  userId,
  customerEmail,
  metadata,
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
  const payload = {
    id: job.id,
    paymentIntentId: job.paymentIntentId,
    totalCents: job.totalCents,
    currency: job.currency,
    lineItems: job.lineItems,
    shipping: job.shipping,
    metadata: job.metadata,
    userId: job.userId,
    customerEmail: job.customerEmail,
    createdAt: job.createdAt,
  }
  const errors: string[] = []
  for (const target of WEBHOOK_TARGETS) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (target.secret) headers.Authorization = `Bearer ${target.secret}`
      const response = await fetch(target.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
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
