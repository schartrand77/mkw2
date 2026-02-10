import { prisma } from '@/lib/db'
import { mapFulfillmentToOrderStatus, mapOrderStatusToFulfillment, type FulfillmentStatusKey } from '@/lib/order-status'
import { maybeConsumeStockForOrder } from '@/lib/stockworks-consumption'
import { findLinkedJobForOrder, findLinkedOrderForJob } from '@/lib/orderworks-link'

type OrderStatusUpdate = { id: string; status: string } | null

export async function syncOrderStatusFromFulfillment(paymentIntentId: string, fulfillmentStatus?: FulfillmentStatusKey | null): Promise<OrderStatusUpdate> {
  if (!paymentIntentId || !fulfillmentStatus) return null
  const job = await prisma.jobForm.findUnique({
    where: { paymentIntentId },
    select: { id: true, paymentIntentId: true, metadata: true },
  })
  const order = await findLinkedOrderForJob({
    paymentIntentId,
    jobFormId: job?.id,
    metadata: job?.metadata,
  })
  if (!order || order.status === 'cancelled') return null
  const nextStatus = mapFulfillmentToOrderStatus(fulfillmentStatus)
  if (order.status === nextStatus) return order
  const updated = await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      status: nextStatus,
      failedAt: null,
      failureNote: null,
      ...(nextStatus === 'queued' ? { printerId: null, printerAssignedAt: null, printerAssignedBy: null } : {}),
    },
    select: { id: true, status: true },
  })
  await maybeConsumeStockForOrder(order.id, 'orderworks-fulfillment')
  return updated
}

export async function syncJobFulfillmentFromOrderStatus(orderId: string): Promise<{ jobId: string; fulfillmentStatus: FulfillmentStatusKey } | null> {
  if (!orderId) return null
  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, metadata: true },
  })
  if (!order) return null
  const job = await findLinkedJobForOrder(order.id, order.metadata)
  if (!job) return null
  const fulfillmentStatus = mapOrderStatusToFulfillment(order.status)
  if (job.fulfillmentStatus === fulfillmentStatus) return { jobId: job.id, fulfillmentStatus }
  await prisma.jobForm.update({
    where: { id: job.id },
    data: { fulfillmentStatus },
    select: { id: true },
  })
  return { jobId: job.id, fulfillmentStatus }
}
