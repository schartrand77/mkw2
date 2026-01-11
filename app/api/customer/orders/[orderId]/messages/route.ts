import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type CustomerOrderMessageContext = { params: Promise<{ orderId: string }> }

export async function POST(req: NextRequest, { params }: CustomerOrderMessageContext) {
  try {
    const { orderId } = await params
    const userId = await getUserIdFromCookie()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({} as any))
    const text = typeof body.body === 'string' ? body.body.trim() : typeof body.message === 'string' ? body.message.trim() : ''
    if (!text) return NextResponse.json({ error: 'Message is required.' }, { status: 400 })

    const order = await prisma.printOrder.findFirst({ where: { id: orderId, userId }, select: { id: true } })
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

    const message = await prisma.printOrderMessage.create({
      data: {
        orderId,
        userId,
        senderRole: 'customer',
        body: text,
      },
    })

    return NextResponse.json({
      message: {
        id: message.id,
        body: message.body,
        senderRole: message.senderRole,
        createdAt: message.createdAt,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unable to send message.' }, { status: 500 })
  }
}
