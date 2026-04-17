import path from 'path'
import { randomUUID } from 'crypto'
import type { Prisma, PrintOrder, PrintOrderApprovalRequest, PrintOrderItem, PrintOrderMessage, PrintOrderRevision } from '@prisma/client'
import type { JobForm } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { CheckoutLineItem, ShippingSelection, CheckoutPaymentMethod } from '@/types/checkout'
import { saveBuffer } from '@/lib/storage'
import type { OrderStatus } from '@/lib/order-status'
import { normalizePaymentMethod as normalizeOrderWorksPaymentMethod } from '@/lib/orderworks-status'
import { listOrganizationIdsForUser } from '@/lib/organizations'

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
  organizationId?: string | null
  metadata?: Prisma.InputJsonValue
}

function normalizeCurrency(code: string) {
  if (!code) return 'USD'
  return code.toUpperCase()
}

function normalizeShippingSelection(raw: unknown): ShippingSelection {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { method: 'pickup' }
  }
  const value = raw as ShippingSelection
  if (value.method === 'ship') {
    return { method: 'ship', address: value.address || undefined }
  }
  return { method: 'pickup' }
}

function normalizePaymentMethod(raw?: string | null): CheckoutPaymentMethod {
  const normalized = normalizeOrderWorksPaymentMethod(raw)
  if (normalized === 'cash' || normalized === 'invoice' || normalized === 'po' || normalized === 'quote') {
    return normalized
  }
  return 'card'
}

function coerceLineItems(raw: unknown): CheckoutLineItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item) => item && typeof item === 'object') as CheckoutLineItem[]
}

export async function recordCustomerOrder(payload: PersistOrderPayload) {
  const subtotal = payload.lineItems.reduce((sum, item) => {
    const base = item.undiscountedLineTotal ?? item.lineTotal
    return sum + Math.max(0, base)
  }, 0)
  const subtotalCents = Math.max(0, Math.round((subtotal > 0 ? subtotal : payload.amountCents / 100) * 100))
  const shippingData = payload.shipping || { method: 'pickup' }
  const isQuote = payload.paymentMethod === 'quote'
  const isDeferred = payload.paymentMethod === 'cash' || payload.paymentMethod === 'invoice' || payload.paymentMethod === 'po'
  const status: OrderStatus = payload.amountCents <= 0
    ? 'queued'
    : isQuote
      ? 'awaiting_review'
      : isDeferred
        ? 'awaiting_payment'
        : 'queued'
  const itemsData: Prisma.PrintOrderItemCreateWithoutOrderInput[] = payload.lineItems.map((item) => ({
    modelId: item.modelId,
    modelTitle: item.title,
    partId: item.partId || undefined,
    partName: item.partName || undefined,
    material: item.material,
    colors: item.colors && item.colors.length > 0 ? item.colors : undefined,
    infillPct: item.infillPct ?? undefined,
    finish: item.finish ?? undefined,
    customNotes: item.customText || undefined,
    quantity: item.qty,
    unitPriceCents: Math.max(0, Math.round(item.unitPrice * 100)),
    totalCents: Math.max(0, Math.round(item.lineTotal * 100)),
    configuration: {
      productTemplateId: item.productTemplateId,
      scale: item.scale,
      colors: item.colors,
      toleranceClass: item.toleranceClass ?? 'standard',
      infillPct: item.infillPct,
      finish: item.finish,
      customText: item.customText,
      leadTimeHours: item.leadTimeHours ?? null,
      leadTimeWindowHours: item.leadTimeWindowHours ?? null,
      etaConfidenceScore: item.etaConfidenceScore ?? null,
      priceMultiplier: item.pricingBreakdown?.priceMultiplier,
      storagePath: item.storagePath,
      storageUrl: item.storageUrl,
    },
    viewerPath: item.storagePath || undefined,
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
  const metadataRecord = metadataPayload as Record<string, unknown>
  const organizationRole = typeof metadataRecord.organizationRole === 'string' ? metadataRecord.organizationRole : null
  const orgRequiresApproval = metadataRecord.quoteApprovalRequired === true

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
      organizationId: payload.organizationId || undefined,
      userId: payload.userId || undefined,
      customerEmail: payload.customerEmail || undefined,
      customerName: payload.customerName || undefined,
      items: {
        create: itemsData,
      },
      ...(isQuote
        ? {
          approvalRequests: {
            create: {
              message: organizationRole === 'requester' || orgRequiresApproval
                ? 'Requester submitted quote. Approver review is required before production.'
                : 'Please approve this quote to move your order into production.',
            },
          },
        }
        : {}),
    },
  })
}

export type OrderListEntry = PrintOrder & { items: Pick<PrintOrderItem, 'id' | 'modelTitle' | 'quantity' | 'totalCents' | 'thumbnailPath'>[] }

type OrderWorksLink = {
  paymentIntentId: string | null
  jobFormId: string | null
}

function extractOrderWorksLink(metadata: unknown): OrderWorksLink | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const record = metadata as Record<string, unknown>
  const source = typeof record.source === 'string' ? record.source.trim().toLowerCase() : null
  const paymentIntentId = typeof record.paymentIntentId === 'string' && record.paymentIntentId.trim().length > 0
    ? record.paymentIntentId.trim()
    : null
  const jobFormId = typeof record.jobFormId === 'string' && record.jobFormId.trim().length > 0
    ? record.jobFormId.trim()
    : null

  if (source !== 'orderworks' && !jobFormId) return null
  return { paymentIntentId, jobFormId }
}

async function filterVisibleOrdersForUser<T extends { id: string; metadata: unknown }>(orders: T[]): Promise<T[]> {
  if (orders.length === 0) return orders

  const linked = orders
    .map((order) => ({ orderId: order.id, link: extractOrderWorksLink(order.metadata) }))
    .filter((entry): entry is { orderId: string; link: OrderWorksLink } => Boolean(entry.link))

  if (linked.length === 0) return orders

  const paymentIntentIds = Array.from(new Set(linked.map((entry) => entry.link.paymentIntentId).filter((v): v is string => Boolean(v))))
  const jobFormIds = Array.from(new Set(linked.map((entry) => entry.link.jobFormId).filter((v): v is string => Boolean(v))))
  const jobWhere: Prisma.JobFormWhereInput[] = []
  if (paymentIntentIds.length > 0) jobWhere.push({ paymentIntentId: { in: paymentIntentIds } })
  if (jobFormIds.length > 0) jobWhere.push({ id: { in: jobFormIds } })
  if (jobWhere.length === 0) return orders

  const jobs = await prisma.jobForm.findMany({
    where: { OR: jobWhere },
    select: { id: true, paymentIntentId: true },
  })
  const jobIds = new Set(jobs.map((job) => job.id))
  const paymentIds = new Set(jobs.map((job) => job.paymentIntentId))

  return orders.filter((order) => {
    const link = extractOrderWorksLink(order.metadata)
    if (!link) return true
    if (link.jobFormId && jobIds.has(link.jobFormId)) return true
    if (link.paymentIntentId && paymentIds.has(link.paymentIntentId)) return true
    return false
  })
}

export async function listOrdersForUser(userId: string, limit = 20): Promise<OrderListEntry[]> {
  if (!userId) return []
  const orgIds = await listOrganizationIdsForUser(userId)
  const orders = await prisma.printOrder.findMany({
    where: {
      OR: [
        { userId },
        ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
      ],
    },
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
  return filterVisibleOrdersForUser(orders)
}

export type OrderDetail = PrintOrder & {
  items: PrintOrderItem[]
  revisions: (PrintOrderRevision & { user?: { id: string; name: string | null; email: string } | null })[]
  messages: (PrintOrderMessage & { user?: { id: string; name: string | null; email: string } | null })[]
  approvalRequests: (PrintOrderApprovalRequest & { requestedBy?: { id: string; name: string | null; email: string } | null })[]
  failurePhotos: { id: string; filePath: string; label: string; confidence: number | null; note: string | null; createdAt: Date }[]
  reprintOf: { id: string; orderNumber: number | null } | null
  reprints: { id: string; orderNumber: number | null; status: string; createdAt: Date }[]
}

export async function createOrderFromJobForm(job: JobForm & { user?: { id: string; name: string | null; email: string | null } | null }) {
  if (!job?.paymentIntentId) return null
  const existing = await prisma.printOrder.findFirst({
    where: {
      metadata: {
        path: ['paymentIntentId'],
        equals: job.paymentIntentId,
      },
    },
  })
  if (existing) return existing

  const lineItems = coerceLineItems(job.lineItems)
  if (lineItems.length === 0) return null
  const shipping = normalizeShippingSelection(job.shipping)
  const paymentMethod = normalizePaymentMethod(job.paymentMethod)

  return recordCustomerOrder({
    paymentIntentId: job.paymentIntentId,
    amountCents: job.totalCents,
    currency: normalizeCurrency(job.currency),
    lineItems,
    shipping,
    paymentMethod,
    userId: job.userId || undefined,
    customerEmail: job.customerEmail || job.user?.email || undefined,
    customerName: job.user?.name || undefined,
    metadata: {
      source: 'orderworks',
      jobFormId: job.id,
      shipping: job.shipping,
      ...(job.metadata && typeof job.metadata === 'object' && !Array.isArray(job.metadata) ? job.metadata : {}),
    },
  })
}

export async function getOrderForUser(orderId: string, userId: string): Promise<OrderDetail | null> {
  if (!userId) return null
  const orgIds = await listOrganizationIdsForUser(userId)
  const order = await prisma.printOrder.findFirst({
    where: {
      id: orderId,
      OR: [
        { userId },
        ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
      ],
    },
    include: {
      items: true,
      revisions: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      approvalRequests: {
        orderBy: { createdAt: 'asc' },
        include: { requestedBy: { select: { id: true, name: true, email: true } } },
      },
      failurePhotos: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, filePath: true, label: true, confidence: true, note: true, createdAt: true },
      },
      reprintOf: { select: { id: true, orderNumber: true } },
      reprints: { select: { id: true, orderNumber: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
    },
  })
  if (!order) return null
  const visible = await filterVisibleOrdersForUser([order])
  return visible.length > 0 ? order : null
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
      status: 'queued',
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
