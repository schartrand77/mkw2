import { prisma } from '@/lib/db'
import { mapFulfillmentToOrderStatus, type FulfillmentStatusKey } from '@/lib/order-status'
import { maybeConsumeStockForOrder } from '@/lib/stockworks-consumption'

type OrderStatusUpdate = { id: string; status: string } | null

export async function syncOrderStatusFromFulfillment(paymentIntentId: string, fulfillmentStatus?: FulfillmentStatusKey | null): Promise<OrderStatusUpdate> {
  if (!paymentIntentId || !fulfillmentStatus) return null
  const order = await prisma.printOrder.findFirst({
    where: {
      metadata: {
        path: ['paymentIntentId'],
        equals: paymentIntentId,
      },
    },
    select: { id: true, status: true },
  })
  if (!order || order.status === 'cancelled') return null
  const nextStatus = mapFulfillmentToOrderStatus(fulfillmentStatus)
  if (order.status === nextStatus) return order
  const updated = await prisma.printOrder.update({
    where: { id: order.id },
    data: { status: nextStatus },
    select: { id: true, status: true },
  })
  await maybeConsumeStockForOrder(order.id, 'orderworks-fulfillment')
  return updated
}
