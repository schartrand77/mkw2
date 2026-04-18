import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { refundStripeOrder } from '@/lib/stripe-payments'
import { withRequestObservability } from '@/lib/request-observability'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ orderId: string }> }

async function handlePost(req: NextRequest, { params }: Context) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const { orderId } = await params
  const body = await req.json().catch(() => ({})) as { amountCents?: number; reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' }
  try {
    const refund = await refundStripeOrder({
      orderId,
      amountCents: typeof body.amountCents === 'number' ? body.amountCents : undefined,
      reason: body.reason,
    })
    return NextResponse.json({ ok: true, refundId: refund.id, status: refund.status, amount: refund.amount })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Refund failed' }, { status: err?.status || 500 })
  }
}

export const POST = withRequestObservability(handlePost, { routeName: '/api/admin/orders/[orderId]/refund' })
