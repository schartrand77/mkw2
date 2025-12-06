import { NextResponse } from 'next/server'
import { getUserIdFromCookie } from '@/lib/auth'
import { createReprintOrder } from '@/lib/orders'

type CustomerReprintContext = { params: Promise<{ orderId: string }> }

export async function POST(_: Request, { params }: CustomerReprintContext) {
  const { orderId } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const order = await createReprintOrder(orderId, userId)
    return NextResponse.json({ order: { id: order.id, orderNumber: order.orderNumber, status: order.status } })
  } catch (err: any) {
    const message = err?.message || 'Unable to request reprint'
    const status = message.toLowerCase().includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
