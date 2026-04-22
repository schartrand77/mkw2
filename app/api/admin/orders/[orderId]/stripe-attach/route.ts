import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminRouteGuards } from '@/app/api/admin/_utils'
import { prisma } from '@/lib/db'
import { mergeStripePaymentIntentReference, stripePaymentAdminOps } from '@/lib/stripe-payments'
import { withRequestObservability } from '@/lib/request-observability'

export const dynamic = 'force-dynamic'

const payloadSchema = z.object({
  paymentIntentId: z.string().trim().regex(/^pi_[A-Za-z0-9]+$/, 'A valid Stripe PaymentIntent ID is required.'),
})

type Context = { params: Promise<{ orderId: string }> }

function extractLegacyPaymentIntentId(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>).paymentIntentId
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

async function handlePost(req: NextRequest, { params }: Context) {
  try { await adminRouteGuards.requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }

  let payload: z.infer<typeof payloadSchema>
  try {
    payload = payloadSchema.parse(await req.json())
  } catch (e: any) {
    const firstIssue = Array.isArray(e?.issues) ? e.issues[0] : null
    return NextResponse.json({ error: firstIssue?.message || 'Invalid request body.' }, { status: 400 })
  }

  const { orderId } = await params
  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: { id: true, metadata: true },
  } as any)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const existing = await prisma.printOrder.findFirst({
    where: {
      id: { not: orderId },
      OR: [
        { stripePaymentIntentId: payload.paymentIntentId } as any,
        { metadata: { path: ['stripe', 'paymentIntentId'], equals: payload.paymentIntentId } },
      ],
    },
    select: { id: true },
  } as any)
  if (existing) {
    return NextResponse.json({ error: 'That Stripe PaymentIntent is already linked to another order.' }, { status: 409 })
  }

  const priorPaymentIntentId = extractLegacyPaymentIntentId(order.metadata)
  const linkedJob = await prisma.jobForm.findFirst({
    where: {
      OR: [
        { metadata: { path: ['orderId'], equals: orderId } },
        ...(priorPaymentIntentId ? [{ paymentIntentId: priorPaymentIntentId }] : []),
      ],
    },
    select: { id: true, paymentIntentId: true, paymentMethod: true },
    orderBy: { createdAt: 'desc' },
  } as any)

  await prisma.printOrder.update({
    where: { id: orderId },
    data: {
      stripePaymentIntentId: payload.paymentIntentId,
      metadata: mergeStripePaymentIntentReference(order.metadata, payload.paymentIntentId),
    },
  } as any)

  if (linkedJob && linkedJob.paymentIntentId !== payload.paymentIntentId) {
    await prisma.jobForm.update({
      where: { id: linkedJob.id },
      data: {
        paymentIntentId: payload.paymentIntentId,
        paymentMethod: 'card',
      },
    } as any)
  } else if (linkedJob && linkedJob.paymentMethod !== 'card') {
    await prisma.jobForm.update({
      where: { id: linkedJob.id },
      data: {
        paymentMethod: 'card',
      },
    } as any)
  }

  try {
    const result = await stripePaymentAdminOps.syncStripePaymentIntent(payload.paymentIntentId, 'admin.attach')
    return NextResponse.json({ ok: true, paymentIntentId: payload.paymentIntentId, paymentStatus: result.paymentStatus, updatedOrders: result.updatedOrders })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Stripe sync failed' }, { status: e?.status || 400 })
  }
}

export const POST = withRequestObservability(handlePost, { routeName: '/api/admin/orders/[orderId]/stripe-attach' })
