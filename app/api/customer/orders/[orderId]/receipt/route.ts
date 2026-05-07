import { NextResponse } from 'next/server'
import { getUserIdFromCookie } from '@/lib/auth'
import { getOrderForUser } from '@/lib/orders'
import { generateAndStoreOrderReceipt } from '@/lib/receipts/order-receipts'

type Context = { params: Promise<{ orderId: string }> }

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: Context) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await params
  const order = await getOrderForUser(orderId, userId)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const result = await generateAndStoreOrderReceipt(order.id)
  return new NextResponse(new Uint8Array(result.pdf), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${result.model.orderNumber}-receipt.pdf"`,
      'cache-control': 'no-store',
    },
  })
}
