import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../../_utils'

export const dynamic = 'force-dynamic'

type AdminOrderMessageContext = { params: Promise<{ orderId: string }> }

export async function POST(req: NextRequest, { params }: AdminOrderMessageContext) {
  try {
    const { orderId } = await params
    const adminId = await requireAdmin()
    const body = await req.json().catch(() => ({} as any))
    const text = typeof body.body === 'string' ? body.body.trim() : typeof body.message === 'string' ? body.message.trim() : ''
    if (!text) return NextResponse.json({ error: 'Message is required.' }, { status: 400 })

    const order = await prisma.printOrder.findUnique({ where: { id: orderId }, select: { id: true } })
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

    const message = await prisma.printOrderMessage.create({
      data: {
        orderId,
        userId: adminId,
        senderRole: 'shop',
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
    const status = err?.status || 500
    return NextResponse.json({ error: err?.message || 'Unable to send message.' }, { status })
  }
}
