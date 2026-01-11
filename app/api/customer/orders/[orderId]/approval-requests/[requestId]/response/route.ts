import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type ApprovalResponseContext = { params: Promise<{ orderId: string; requestId: string }> }

const VALID_STATUSES = new Set(['approved', 'changes_requested'])

export async function POST(req: NextRequest, { params }: ApprovalResponseContext) {
  try {
    const { orderId, requestId } = await params
    const userId = await getUserIdFromCookie()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({} as any))
    const status = typeof body.status === 'string' ? body.status : ''
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
    }
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : undefined

    const order = await prisma.printOrder.findFirst({ where: { id: orderId, userId }, select: { id: true } })
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

    const request = await prisma.printOrderApprovalRequest.findFirst({
      where: { id: requestId, orderId },
      select: { id: true, status: true },
    })
    if (!request) return NextResponse.json({ error: 'Approval request not found.' }, { status: 404 })
    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'This request has already been answered.' }, { status: 409 })
    }

    const updated = await prisma.printOrderApprovalRequest.update({
      where: { id: requestId },
      data: {
        status,
        responseNote: note,
        respondedAt: new Date(),
      },
    })

    return NextResponse.json({
      request: {
        id: updated.id,
        status: updated.status,
        responseNote: updated.responseNote,
        respondedAt: updated.respondedAt,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unable to submit response.' }, { status: 500 })
  }
}
