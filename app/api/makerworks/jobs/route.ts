import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { FulfillmentStatus } from '@prisma/client'
import { serializeJob, type JobWithUser } from '@/app/api/admin/orderworks/jobs/_helpers'
import { sendAdminPushNotification } from '@/lib/push'
import { syncOrderStatusFromFulfillment } from '@/lib/orderworks-sync'
import { createOrderFromJobForm } from '@/lib/orders'
import {
  isPaidPaymentStatus,
  isPaymentPromise,
  normalizePaymentMethod,
  normalizePaymentStatus,
} from '@/lib/orderworks-status'
import { incrementMetric } from '@/lib/observability-metrics'
import { withRequestObservability } from '@/lib/request-observability'

const webhookPayloadSchema = z.object({
  paymentIntentId: z.string().min(4).max(200),
  status: z.enum(['pending', 'sent']).optional(),
  totalCents: z.number().int().nonnegative().optional(),
  currency: z.string().min(3).max(12).optional(),
  lineItems: z.array(z.any()).optional(),
  shipping: z.any().optional(),
  metadata: z.any().optional(),
  userId: z.string().optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
  paymentStatus: z.string().max(120).optional().nullable(),
  paymentMethod: z.string().max(120).optional().nullable(),
  payment: z
    .object({
      status: z.string().max(120).optional().nullable(),
      method: z.string().max(120).optional().nullable(),
    })
    .partial()
    .optional(),
  fulfillmentStatus: z.nativeEnum(FulfillmentStatus).optional(),
  fulfilledAt: z.union([z.string(), z.date(), z.null()]).optional(),
})

function timingSafeEqual(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function getSecret(): string | null {
  return process.env['MAKERWORKS_INBOUND_SECRET'] || null
}

function verifyBearerSecret(req: NextRequest, secret: string) {
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7)
    if (timingSafeEqual(token, secret)) return true
  }
  const headerToken = req.headers.get('x-makerworks-secret')
  if (headerToken && timingSafeEqual(headerToken, secret)) return true
  const queryToken = req.nextUrl.searchParams.get('secret')
  if (queryToken && timingSafeEqual(queryToken, secret)) return true
  return false
}

function parseSignature(headerValue: string | null) {
  if (!headerValue) return null
  const parts = headerValue.split(',').map((entry) => entry.trim())
  const payload: Record<string, string> = {}
  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key && value) payload[key] = value
  }
  if (!payload.t || !payload.v1) return null
  const timestamp = Number(payload.t)
  if (!Number.isFinite(timestamp)) return null
  return { timestamp, signature: payload.v1 }
}

function verifySignatureHeaders(req: NextRequest, body: string, secret: string) {
  const header = req.headers.get('x-makerworks-signature-v1') || req.headers.get('makerworks-signature-v1')
  const parsed = parseSignature(header)
  if (!parsed) return false
  const now = Date.now()
  const toleranceMs = 5 * 60 * 1000
  if (Math.abs(now - parsed.timestamp * 1000) > toleranceMs) return false
  const canonicalPayload = `${parsed.timestamp}.${body}`
  const expected = crypto.createHmac('sha256', secret).update(canonicalPayload).digest('hex')
  return timingSafeEqual(expected, parsed.signature)
}

function normalizeFulfilledAt(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (value instanceof Date) return value
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export const dynamic = 'force-dynamic'

async function handlePost(req: NextRequest) {
  const secret = getSecret()
  if (!secret) {
    incrementMetric('job_webhook_failure_total', 1, { reason: 'secret_missing' })
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }
  const rawBody = await req.text()
  const hasValidSecret = verifyBearerSecret(req, secret) || verifySignatureHeaders(req, rawBody, secret)
  if (!hasValidSecret) {
    incrementMetric('job_webhook_failure_total', 1, { reason: 'invalid_signature' })
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawBody)
  } catch (err: any) {
    incrementMetric('job_webhook_failure_total', 1, { reason: 'invalid_json' })
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }
  const parsed = webhookPayloadSchema.safeParse(parsedJson)
  if (!parsed.success) {
    incrementMetric('job_webhook_failure_total', 1, { reason: 'validation_failed' })
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }
  const data = parsed.data
  const paymentMethod = normalizePaymentMethod(data.paymentMethod ?? data.payment?.method)
  const paymentStatus = normalizePaymentStatus(data.paymentStatus ?? data.payment?.status)
  const fulfillmentStatus = data.fulfillmentStatus
  const fulfilledAt = normalizeFulfilledAt(data.fulfilledAt)

  const updatePayload: Prisma.JobFormUpdateInput = {}
  if (data.status) updatePayload.status = data.status
  if (typeof data.totalCents === 'number') updatePayload.totalCents = data.totalCents
  if (typeof data.currency === 'string') updatePayload.currency = data.currency.toUpperCase()
  if (Array.isArray(data.lineItems)) updatePayload.lineItems = data.lineItems as Prisma.InputJsonValue
  if (data.shipping !== undefined) updatePayload.shipping = data.shipping as Prisma.InputJsonValue
  if (data.metadata !== undefined) updatePayload.metadata = data.metadata as Prisma.InputJsonValue
  if (data.customerEmail !== undefined) updatePayload.customerEmail = data.customerEmail || null
  if (paymentMethod !== undefined) updatePayload.paymentMethod = paymentMethod
  if (paymentStatus !== undefined) updatePayload.paymentStatus = paymentStatus
  if (fulfillmentStatus) updatePayload.fulfillmentStatus = fulfillmentStatus
  if (fulfilledAt !== undefined) updatePayload.fulfilledAt = fulfilledAt

  let job = await prisma.jobForm.findUnique({
    where: { paymentIntentId: data.paymentIntentId },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  const previousPaymentStatus = job?.paymentStatus ?? null
  const previousPaymentMethod = job?.paymentMethod ?? null
  let created = false

  if (!job) {
    if (
      typeof data.totalCents !== 'number' ||
      typeof data.currency !== 'string' ||
      !Array.isArray(data.lineItems)
    ) {
      return NextResponse.json({ error: 'Job not found and insufficient data to create' }, { status: 404 })
    }
    job = (await prisma.jobForm.create({
      data: {
        paymentIntentId: data.paymentIntentId,
        totalCents: data.totalCents,
        currency: data.currency.toUpperCase(),
        lineItems: data.lineItems as Prisma.InputJsonValue,
        shipping: data.shipping as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue,
        userId: data.userId || undefined,
        customerEmail: data.customerEmail || undefined,
        status: data.status || 'pending',
        paymentMethod: paymentMethod ?? undefined,
        paymentStatus: paymentStatus ?? undefined,
        fulfillmentStatus: fulfillmentStatus ?? undefined,
        fulfilledAt: fulfilledAt ?? undefined,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    })) as JobWithUser
    created = true
  } else if (Object.keys(updatePayload).length > 0) {
    job = (await prisma.jobForm.update({
      where: { paymentIntentId: data.paymentIntentId },
      data: updatePayload,
      include: { user: { select: { id: true, name: true, email: true } } },
    })) as JobWithUser
  }

  try {
    if (job && job.fulfillmentStatus) {
      await syncOrderStatusFromFulfillment(job.paymentIntentId, job.fulfillmentStatus)
    }
    if (job && isPaidPaymentStatus(job.paymentStatus)) {
      await createOrderFromJobForm(job)
    }
    if (job) {
      const paymentStatusChanged = paymentStatus !== undefined && job.paymentStatus !== previousPaymentStatus
      const paymentMethodChanged = paymentMethod !== undefined && job.paymentMethod !== previousPaymentMethod
      if (created || paymentStatusChanged || paymentMethodChanged) {
        const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
        const isPromise = isPaymentPromise(job.paymentMethod, job.paymentStatus)
        const label = isPromise ? 'Payment promise received' : (created ? 'Payment received' : 'Payment updated')
        await sendAdminPushNotification({
          title: label,
          body: `Intent ${job.paymentIntentId} - ${job.paymentMethod || 'unknown'} ${job.paymentStatus ? `(${job.paymentStatus})` : ''}`.trim(),
          url: `${baseUrl}/admin/jobs`,
          tag: `payment:${job.paymentIntentId}`,
          data: { paymentIntentId: job.paymentIntentId, paymentMethod: job.paymentMethod, paymentStatus: job.paymentStatus || undefined },
        })
      }
    }
  } catch (notifyErr) {
    console.error('Admin push notification failed for webhook job:', notifyErr)
  }

  incrementMetric('job_webhook_success_total')
  return NextResponse.json({ ok: true, job: serializeJob(job as JobWithUser) })
}

export const POST = withRequestObservability(handlePost, { routeName: '/api/makerworks/jobs' })
