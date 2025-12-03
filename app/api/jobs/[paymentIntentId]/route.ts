import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { FulfillmentStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'
import { serializeJob, type JobWithUser } from '@/app/api/admin/orderworks/jobs/_helpers'

const patchSchema = z.object({
  status: z.enum(['pending', 'sent']).optional(),
  paymentMethod: z.string().max(120).optional().nullable(),
  paymentStatus: z.string().max(120).optional().nullable(),
  fulfillmentStatus: z.nativeEnum(FulfillmentStatus).optional(),
  fulfilledAt: z.union([z.string(), z.date(), z.null()]).optional(),
})

type Params = { params: { paymentIntentId: string } }

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
    where: { paymentIntentId: params.paymentIntentId },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

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
    where: { paymentIntentId: params.paymentIntentId },
    data: updateData,
    include: { user: { select: { id: true, name: true, email: true } } },
  })) as JobWithUser

  return NextResponse.json({ ok: true, job: serializeJob(updated) })
}
