import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { FulfillmentStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'
import { serializeJob, type JobWithUser } from '@/app/api/admin/orderworks/jobs/_helpers'
import { sendAdminPushNotification } from '@/lib/push'
import { syncOrderStatusFromFulfillment } from '@/lib/orderworks-sync'
import { createOrderFromJobForm } from '@/lib/orders'

const patchSchema = z.object({
  status: z.enum(['pending', 'sent']).optional(),
  paymentMethod: z.string().max(120).optional().nullable(),
  paymentStatus: z.string().max(120).optional().nullable(),
  fulfillmentStatus: z.nativeEnum(FulfillmentStatus).optional(),
  fulfilledAt: z.union([z.string(), z.date(), z.null()]).optional(),
})

type Params = { params: Promise<{ paymentIntentId: string }> }

function normalizeString(value: string | null | undefined) {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function parseFulfilledAt(explicit: unknown): Date | null | undefined {
  if (explicit === undefined) return undefined
  if (explicit === null || explicit === '') return null
  if (explicit instanceof Date) return explicit
  const date = new Date(String(explicit))
  return Number.isNaN(date.getTime()) ? null : date
}

function isPaidOrder(paymentMethod?: string | null, paymentStatus?: string | null) {
  const status = (paymentStatus || '').toLowerCase()
  if (!status) return false
  if (status === 'paid' || status === 'succeeded' || status === 'free' || status === 'processing' || status === 'requires_capture') {
    return true
  }
  if (paymentMethod === 'cash' && status === 'paid') return true
  return false
}

function resolveFulfilledAt(
  explicit: unknown,
  nextStatus: FulfillmentStatus | undefined,
  currentStatus: FulfillmentStatus,
  currentValue: Date | null,
): Date | null | undefined {
  const parsed = parseFulfilledAt(explicit)
  if (parsed !== undefined) {
    return parsed
  }
  if (!nextStatus || nextStatus === currentStatus) return undefined
  if (nextStatus === 'picked_up' || nextStatus === 'shipped') {
    return currentValue ?? new Date()
  }
  if (nextStatus === 'pending' || nextStatus === 'ready') {
    return null
  }
  return undefined
}

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: Params) {
  const { paymentIntentId } = await params
  try {
    await requireAdmin()
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }
  const job = await prisma.jobForm.findUnique({
    where: { paymentIntentId },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
  const previousPaymentStatus = job.paymentStatus
  const previousPaymentMethod = job.paymentMethod

  const payload = parsed.data
  const updateData: Prisma.JobFormUpdateInput = {}
  if (payload.status) updateData.status = payload.status
  const paymentMethod = normalizeString(payload.paymentMethod)
  if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod
  const paymentStatus = normalizeString(payload.paymentStatus)
  if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus
  if (payload.fulfillmentStatus) updateData.fulfillmentStatus = payload.fulfillmentStatus
  const fulfilledAt = resolveFulfilledAt(payload.fulfilledAt, payload.fulfillmentStatus, job.fulfillmentStatus, job.fulfilledAt)
  if (fulfilledAt !== undefined) updateData.fulfilledAt = fulfilledAt

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
  }

  const updated = (await prisma.jobForm.update({
    where: { paymentIntentId },
    data: updateData,
    include: { user: { select: { id: true, name: true, email: true } } },
  })) as JobWithUser

  try {
    if (updated.fulfillmentStatus) {
      await syncOrderStatusFromFulfillment(paymentIntentId, updated.fulfillmentStatus)
    }
    if (isPaidOrder(updated.paymentMethod, updated.paymentStatus)) {
      await createOrderFromJobForm(updated)
    }
    const paymentStatusChanged = payload.paymentStatus !== undefined && updated.paymentStatus !== previousPaymentStatus
    const paymentMethodChanged = payload.paymentMethod !== undefined && updated.paymentMethod !== previousPaymentMethod
    if (paymentStatusChanged || paymentMethodChanged) {
      const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
      const method = (updated.paymentMethod || '').toLowerCase()
      const status = (updated.paymentStatus || '').toLowerCase()
      const isPromise = method === 'cash' || status === 'pending'
      await sendAdminPushNotification({
        title: isPromise ? 'Payment promise received' : 'Payment updated',
        body: `Intent ${paymentIntentId} · ${updated.paymentMethod || 'unknown'} ${updated.paymentStatus ? `(${updated.paymentStatus})` : ''}`.trim(),
        url: `${baseUrl}/admin/jobs`,
        tag: `payment:${paymentIntentId}`,
        data: { paymentIntentId, paymentMethod: updated.paymentMethod, paymentStatus: updated.paymentStatus || undefined },
      })
    }
  } catch (notifyErr) {
    console.error('Admin push notification failed for job update:', notifyErr)
  }

  return NextResponse.json({ ok: true, job: serializeJob(updated) })
}
