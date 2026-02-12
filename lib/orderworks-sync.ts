import { prisma } from '@/lib/db'
import { mapFulfillmentToOrderStatus, mapOrderStatusToFulfillment, type FulfillmentStatusKey } from '@/lib/order-status'
import { maybeConsumeStockForOrder } from '@/lib/stockworks-consumption'
import { findLinkedJobsForOrder, findLinkedOrderForJob } from '@/lib/orderworks-link'
import type { Prisma } from '@prisma/client'

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
  const jobs = await findLinkedJobsForOrder(order.id, order.metadata)
  if (jobs.length === 0) return null
  const fulfillmentStatus = mapOrderStatusToFulfillment(order.status)
  const staleJobs = jobs.filter((job) => job.fulfillmentStatus !== fulfillmentStatus)
  if (staleJobs.length > 0) {
    await prisma.jobForm.updateMany({
      where: { id: { in: staleJobs.map((job) => job.id) } },
      data: { fulfillmentStatus },
    })
  }
  return { jobId: jobs[0].id, fulfillmentStatus }
}

function asRecord(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, any>
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
  return out.length > 0 ? out : undefined
}

function asNumber(value: unknown): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function buildShippingPayload(order: { shippingMethod: string; shippingAddress: unknown }): Prisma.InputJsonValue {
  const method = (order.shippingMethod || '').toLowerCase() === 'ship' ? 'ship' : 'pickup'
  if (method === 'pickup') return { method }
  const address = asRecord(order.shippingAddress)
  return address ? { method, address } : { method }
}

function buildJobLineItemsFromOrder(
  items: Array<{
    modelId: string | null
    partId: string | null
    partName: string | null
    modelTitle: string
    quantity: number
    unitPriceCents: number
    totalCents: number
    material: string
    colors: unknown
    infillPct: number | null
    finish: string | null
    customNotes: string | null
    configuration: unknown
    viewerPath: string | null
  }>,
  currentLineItems: unknown,
): Prisma.InputJsonValue {
  const existingItems = Array.isArray(currentLineItems) ? currentLineItems : []
  const payload = items.map((item, idx) => {
    const existing = asRecord(existingItems[idx])
    const config = asRecord(item.configuration)
    const modelId = asString(item.modelId) || asString(existing?.modelId) || `order-item-${idx + 1}`
    const partId = asString(item.partId) || asString(existing?.partId)
    const title = item.modelTitle || asString(existing?.title) || `Item ${idx + 1}`
    const scale = asNumber(config?.scale) || asNumber(existing?.scale) || 1
    const storagePath = asString(config?.storagePath) || asString(existing?.storagePath) || asString(item.viewerPath)
    const storageUrl = asString(config?.storageUrl) || asString(existing?.storageUrl)
    return {
      modelId,
      partId: partId || undefined,
      partName: asString(item.partName) || asString(existing?.partName) || undefined,
      title,
      qty: item.quantity,
      scale,
      unitPrice: Number((item.unitPriceCents / 100).toFixed(2)),
      lineTotal: Number((item.totalCents / 100).toFixed(2)),
      undiscountedLineTotal: Number((item.totalCents / 100).toFixed(2)),
      material: item.material || asString(existing?.material) || 'PLA',
      colors: asStringArray(item.colors) || asStringArray(existing?.colors),
      finish: asString(item.finish) || asString(existing?.finish) || undefined,
      infillPct: item.infillPct ?? (asNumber(existing?.infillPct) ?? undefined),
      customText: asString(item.customNotes) || asString(existing?.customText) || undefined,
      storagePath: storagePath || undefined,
      storageUrl: storageUrl || undefined,
    }
  })
  return payload as Prisma.InputJsonValue
}

export async function syncLinkedJobsFromOrder(orderId: string): Promise<{ updatedJobCount: number } | null> {
  if (!orderId) return null
  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalCents: true,
      currency: true,
      shippingMethod: true,
      shippingAddress: true,
      customerEmail: true,
      metadata: true,
      items: {
        select: {
          modelId: true,
          partId: true,
          partName: true,
          modelTitle: true,
          quantity: true,
          unitPriceCents: true,
          totalCents: true,
          material: true,
          colors: true,
          infillPct: true,
          finish: true,
          customNotes: true,
          configuration: true,
          viewerPath: true,
        },
      },
    },
  })
  if (!order) return null

  const linkedJobs = await findLinkedJobsForOrder(order.id, order.metadata)
  if (linkedJobs.length === 0) return null

  await prisma.$transaction(
    linkedJobs.map((job) => {
      const existingMetadata = asRecord(job.metadata) || {}
      const nextMetadata: Prisma.InputJsonValue = {
        ...existingMetadata,
        orderId: order.id,
        paymentIntentId: job.paymentIntentId,
      }
      return prisma.jobForm.update({
        where: { id: job.id },
        data: {
          totalCents: order.totalCents,
          currency: (order.currency || job.currency || 'USD').toUpperCase(),
          customerEmail: order.customerEmail || job.customerEmail || null,
          shipping: buildShippingPayload(order),
          lineItems: buildJobLineItemsFromOrder(order.items, job.lineItems),
          metadata: nextMetadata,
        },
        select: { id: true },
      })
    }),
  )

  return { updatedJobCount: linkedJobs.length }
}
