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

const ORDERWORKS_URL = process.env.ORDERWORKS_WEBHOOK_URL
const ORDERWORKS_SECRET = process.env.ORDERWORKS_WEBHOOK_SECRET

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
  if (!ORDERWORKS_URL) {
    console.warn('ORDERWORKS_WEBHOOK_URL not configured; skipping OrderWorks sync.')
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
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ORDERWORKS_SECRET) headers.Authorization = `Bearer ${ORDERWORKS_SECRET}`
  const response = await fetch(ORDERWORKS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  const success = response.ok
  const errorText = success ? null : await response.text()
  await prisma.jobForm.update({
    where: { id: job.id },
    data: {
      status: success ? 'sent' : 'pending',
      webhookAttempts: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: success ? null : (errorText || response.statusText).slice(0, 500),
    },
  })
  if (!success) {
    throw new Error(`OrderWorks responded with ${response.status}`)
  }
}

export async function queueOrderWorksJob(jobId: string) {
  if (!ORDERWORKS_URL) return
  await sendJobToOrderWorks(jobId)
}

export async function retryPendingOrderWorksJobs(limit = 10) {
  if (!ORDERWORKS_URL) return { processed: 0, message: 'Webhook URL missing' }
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
