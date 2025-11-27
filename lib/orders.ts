import path from 'path'
import { randomUUID } from 'crypto'
import type { Prisma, PrintOrder, PrintOrderItem, PrintOrderRevision } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { CheckoutLineItem, ShippingSelection, CheckoutPaymentMethod } from '@/types/checkout'
import { saveBuffer } from '@/lib/storage'

export const ORDER_STATUSES = [
  { key: 'awaiting_review', label: 'Awaiting review' },
  { key: 'awaiting_payment', label: 'Awaiting payment' },
  { key: 'in_production', label: 'In production' },
  { key: 'ready', label: 'Ready for pickup' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]['key']

type PersistOrderPayload = {
  paymentIntentId: string
  amountCents: number
  currency: string
  lineItems: CheckoutLineItem[]
  shipping: ShippingSelection
  paymentMethod: CheckoutPaymentMethod
  userId?: string | null
  customerEmail?: string | null
  customerName?: string | null
  discountPercent?: number | null
  metadata?: Prisma.InputJsonValue
}

function normalizeCurrency(code: string) {
  if (!code) return 'USD'
  return code.toUpperCase()
}

export async function recordCustomerOrder(payload: PersistOrderPayload) {
  const subtotal = payload.lineItems.reduce((sum, item) => {
    const base = item.undiscountedLineTotal ?? item.lineTotal
    return sum + Math.max(0, base)
  }, 0)
  const subtotalCents = Math.max(0, Math.round((subtotal > 0 ? subtotal : payload.amountCents / 100) * 100))
  const shippingData = payload.shipping || { method: 'pickup' }
  const status: OrderStatus = payload.paymentMethod === 'cash' ? 'awaiting_payment' : 'awaiting_review'
  const itemsData: Prisma.PrintOrderItemCreateWithoutOrderInput[] = payload.lineItems.map((item) => ({
    modelId: item.modelId,
    modelTitle: item.title,
    partId: item.partId || undefined,
    partName: item.partName || undefined,
    material: item.material,
    colors: item.colors && item.colors.length > 0 ? item.colors : undefined,
    infillPct: item.infillPct ?? undefined,
    finish: undefined,
    customNotes: item.customText || undefined,
    quantity: item.qty,
    unitPriceCents: Math.max(0, Math.round(item.unitPrice * 100)),
    totalCents: Math.max(0, Math.round(item.lineTotal * 100)),
    configuration: {
      scale: item.scale,
      colors: item.colors,
      infillPct: item.infillPct,
      customText: item.customText,
    },
  }))
  const metadataPayload: Prisma.InputJsonValue = (() => {
    if (payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)) {
      return {
        paymentIntentId: payload.paymentIntentId,
        ...(payload.metadata as Record<string, any>),
      }
    }
    if (Array.isArray(payload.metadata)) {
      return {
        paymentIntentId: payload.paymentIntentId,
        details: payload.metadata,
      }
    }
    return { paymentIntentId: payload.paymentIntentId }
  })()

  return prisma.printOrder.create({
    data: {
      paymentMethod: payload.paymentMethod,
      shippingMethod: shippingData.method || 'pickup',
      shippingAddress: shippingData.address ? shippingData.address : undefined,
      status,
      subtotalCents,
      discountPercent: payload.discountPercent ?? undefined,
      totalCents: payload.amountCents,
      currency: normalizeCurrency(payload.currency),
      metadata: metadataPayload,
      userId: payload.userId || undefined,
      customerEmail: payload.customerEmail || undefined,
      customerName: payload.customerName || undefined,
      items: {
        create: itemsData,
      },
    },
  })
}

export type OrderListEntry = PrintOrder & { items: Pick<PrintOrderItem, 'id' | 'modelTitle' | 'quantity' | 'totalCents' | 'thumbnailPath'>[] }

export async function listOrdersForUser(userId: string, limit = 20): Promise<OrderListEntry[]> {
  if (!userId) return []
  return prisma.printOrder.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      items: {
        select: {
          id: true,
          modelTitle: true,
          quantity: true,
          totalCents: true,
          thumbnailPath: true,
        },
      },
    },
  })
}

export type OrderDetail = PrintOrder & {
  items: PrintOrderItem[]
  revisions: (PrintOrderRevision & { user?: { id: string; name: string | null; email: string } | null })[]
  reprintOf: { id: string; orderNumber: number | null } | null
  reprints: { id: string; orderNumber: number | null; status: string; createdAt: Date }[]
}

export async function getOrderForUser(orderId: string, userId: string): Promise<OrderDetail | null> {
  if (!userId) return null
  return prisma.printOrder.findFirst({
    where: { id: orderId, userId },
    include: {
      items: true,
      revisions: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      reprintOf: { select: { id: true, orderNumber: true } },
      reprints: { select: { id: true, orderNumber: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
    },
  })
}

export async function createReprintOrder(orderId: string, userId: string) {
  const source = await prisma.printOrder.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  })
  if (!source) throw new Error('Order not found')
  const metadata: Record<string, any> = {}
  if (source.metadata && typeof source.metadata === 'object' && !Array.isArray(source.metadata)) {
    Object.assign(metadata, source.metadata as Record<string, any>)
  }
  metadata.reprintRequestedAt = new Date().toISOString()
  metadata.reprintSourceOrderId = source.id
  return prisma.printOrder.create({
    data: {
      userId: source.userId,
      customerEmail: source.customerEmail,
      customerName: source.customerName,
      paymentMethod: source.paymentMethod,
      shippingMethod: source.shippingMethod,
      shippingAddress: source.shippingAddress ?? undefined,
      status: 'awaiting_review',
      subtotalCents: source.subtotalCents,
      discountPercent: source.discountPercent,
      totalCents: source.totalCents,
      currency: source.currency,
      metadata,
      reprintOfId: source.id,
      items: {
        create: source.items.map((item) => ({
          modelId: item.modelId,
          modelTitle: item.modelTitle,
          partId: item.partId ?? undefined,
          partName: item.partName ?? undefined,
          material: item.material,
          colors: item.colors ?? undefined,
          infillPct: item.infillPct ?? undefined,
          finish: item.finish ?? undefined,
          customNotes: item.customNotes ?? undefined,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          totalCents: item.totalCents,
          configuration: item.configuration ?? undefined,
          thumbnailPath: item.thumbnailPath ?? undefined,
          viewerPath: item.viewerPath ?? undefined,
        })),
      },
    },
  })
}

export type RevisionPayload = {
  orderId: string
  userId: string
  filename: string
  note?: string
  buffer: Buffer
}

export async function addOrderRevision({ orderId, userId, filename, note, buffer }: RevisionPayload) {
  const order = await prisma.printOrder.findFirst({ where: { id: orderId, userId }, select: { id: true } })
  if (!order) throw new Error('Order not found')
  const sanitizedName = filename.replace(/[^a-z0-9_.-]+/gi, '-')
  const relDir = path.posix.join('orders', orderId, 'revisions')
  const relPath = path.posix.join(relDir, `${Date.now()}-${randomUUID()}-${sanitizedName}`)
  await saveBuffer(relPath, buffer)
  const revisionCount = await prisma.printOrderRevision.count({ where: { orderId } })
  return prisma.printOrderRevision.create({
    data: {
      orderId,
      userId,
      label: filename,
      note: note || undefined,
      filePath: relPath,
      version: revisionCount + 1,
    },
  })
}
