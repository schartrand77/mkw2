import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/api/admin/_utils'
import { ORDER_STATUS_FLOW, mapOrderStatusToFulfillment } from '@/lib/order-status'
import { maybeConsumeStockForOrder } from '@/lib/stockworks-consumption'

const statusKeys = ORDER_STATUS_FLOW.map((entry) => entry.key) as [string, ...string[]]

const payloadSchema = z.object({
  status: z.enum(statusKeys),
  failureNote: z.string().max(400).optional(),
})

type RouteParams = { params: Promise<{ orderId: string }> }

function extractPaymentIntentId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as { paymentIntentId?: unknown }).paymentIntentId
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

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
      select: { id: true, status: true, metadata: true },
    })
    const paymentIntentId = extractPaymentIntentId(order.metadata)
    if (paymentIntentId) {
      await prisma.jobForm.updateMany({
        where: { paymentIntentId },
        data: { fulfillmentStatus: mapOrderStatusToFulfillment(payload.status) },
      })
    }
    await maybeConsumeStockForOrder(order.id, 'admin-status-update')
    return NextResponse.json({ order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request.' }, { status: 400 })
  }
}
