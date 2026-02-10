import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'
import { ORDER_STATUS_FLOW } from '@/lib/order-status'
import { maybeConsumeStockForOrder } from '@/lib/stockworks-consumption'
import { syncJobFulfillmentFromOrderStatus } from '@/lib/orderworks-sync'

const statusKeys = ORDER_STATUS_FLOW.map((entry) => entry.key) as [string, ...string[]]

const payloadSchema = z.object({
  status: z.enum(statusKeys),
  failureNote: z.string().max(400).optional(),
})

type RouteParams = { params: Promise<{ orderId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try { await requireAdmin() } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const { orderId } = await params
    const payload = payloadSchema.parse(await req.json())
    const isFailed = payload.status === 'failed'
    const order = await prisma.printOrder.update({
      where: { id: orderId },
      data: {
        status: payload.status,
        failedAt: isFailed ? new Date() : null,
        failureNote: isFailed ? (payload.failureNote?.trim() || null) : null,
        ...(payload.status === 'queued' ? { printerId: null, printerAssignedAt: null, printerAssignedBy: null } : {}),
      },
      select: { id: true, status: true },
    })
    await syncJobFulfillmentFromOrderStatus(order.id)
    await maybeConsumeStockForOrder(order.id, 'admin-status-update')
    return NextResponse.json({ order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request.' }, { status: 400 })
  }
}
