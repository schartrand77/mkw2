import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../../_utils'

export const dynamic = 'force-dynamic'

type AdminApprovalRequestContext = { params: Promise<{ orderId: string }> }

export async function POST(req: NextRequest, { params }: AdminApprovalRequestContext) {
  try {
    const { orderId } = await params
    const adminId = await requireAdmin()
    const body = await req.json().catch(() => ({} as any))
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) return NextResponse.json({ error: 'Message is required.' }, { status: 400 })

    const order = await prisma.printOrder.findUnique({ where: { id: orderId }, select: { id: true } })
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

    const request = await prisma.printOrderApprovalRequest.create({
      data: {
        orderId,
        requestedById: adminId,
        message,
      },
    })

    return NextResponse.json({
      request: {
        id: request.id,
        status: request.status,
        message: request.message,
        createdAt: request.createdAt,
      },
    })
  } catch (err: any) {
    const status = err?.status || 500
    return NextResponse.json({ error: err?.message || 'Unable to request changes.' }, { status })
  }
}
