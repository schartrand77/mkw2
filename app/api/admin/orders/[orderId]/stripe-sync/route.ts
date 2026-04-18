import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { prisma } from '@/lib/db'
import { resolvePaymentIntentIdFromOrder, syncStripePaymentIntent } from '@/lib/stripe-payments'
import { withRequestObservability } from '@/lib/request-observability'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ orderId: string }> }

async function handlePost(_req: NextRequest, { params }: Context) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const { orderId } = await params
  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: { id: true, stripePaymentIntentId: true, metadata: true },
  } as any)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  const paymentIntentId = resolvePaymentIntentIdFromOrder(order)
  if (!paymentIntentId) return NextResponse.json({ error: 'Order does not have a Stripe payment intent' }, { status: 400 })
  const result = await syncStripePaymentIntent(paymentIntentId, 'admin.sync')
  return NextResponse.json({ ok: true, paymentIntentId, paymentStatus: result.paymentStatus, updatedOrders: result.updatedOrders })
}

export const POST = withRequestObservability(handlePost, { routeName: '/api/admin/orders/[orderId]/stripe-sync' })
