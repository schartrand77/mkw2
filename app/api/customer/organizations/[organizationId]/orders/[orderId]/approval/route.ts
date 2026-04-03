import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { getOrganizationMembership, isPrivilegedOrgRole } from '@/lib/organizations'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ organizationId: string; orderId: string }> }

export async function POST(req: NextRequest, { params }: Context) {
  const { organizationId, orderId } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getOrganizationMembership(userId, organizationId)
  if (!membership) return NextResponse.json({ error: 'Organization not found.' }, { status: 404 })
  if (!isPrivilegedOrgRole(membership.role)) {
    return NextResponse.json({ error: 'Only approvers/owners can action org quotes.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : ''
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  }
  const note = typeof body.note === 'string' ? body.note.trim() : ''

  const order = await prisma.printOrder.findFirst({
    where: { id: orderId, organizationId },
    select: { id: true, status: true, metadata: true },
  })
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

  const metadata = {
    ...(order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
      ? order.metadata as Record<string, unknown>
      : {}),
    orgApproval: {
      action,
      note: note || null,
      approvedByUserId: userId,
      approvedAt: new Date().toISOString(),
    },
  }

  const updated = await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      status: action === 'approve' ? 'queued' : 'cancelled',
      metadata,
    },
    select: { id: true, status: true },
  })

  if (action === 'approve') {
    await prisma.printOrderApprovalRequest.updateMany({
      where: {
        orderId: order.id,
        status: 'pending',
      },
      data: {
        status: 'approved',
        responseNote: note || 'Approved by organization approver.',
        respondedAt: new Date(),
      },
    })
  }

  return NextResponse.json({ order: updated })
}
