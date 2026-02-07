import { prisma } from '@/lib/db'
import { estimatePricingDetails } from '@/lib/pricing'
import { normalizeOrderStatus } from '@/lib/order-status'
import type { SiteConfig } from '@prisma/client'

const QUEUE_STATUSES = new Set([
  'queued',
  'printing',
  'post_process',
  'awaiting_review',
  'awaiting_payment',
  'in_production',
  'ready',
])

type PrinterSnapshot = {
  id: string
  name: string
  status: string
  active: boolean
  dailyCapacityHours: number
  notes?: string | null
}

type OrderQueueEntry = {
  id: string
  orderNumber: number | null
  status: string
  createdAt: Date
  customerName?: string | null
  customerEmail?: string | null
  paymentIntentId?: string | null
  orderWorksStatus?: string | null
  orderWorksLastError?: string | null
  totalHours: number
  queuePosition: number | null
  estimatedCompletionAt: Date | null
}

export type ProductionSnapshot = {
  generatedAt: Date
  printers: PrinterSnapshot[]
  capacityHoursPerDay: number
  queueHours: number
  orders: OrderQueueEntry[]
}

function extractPaymentIntentId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as { paymentIntentId?: unknown }).paymentIntentId
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

function resolvePrinterCapacity(printers: PrinterSnapshot[]): number {
  return printers
    .filter((printer) => printer.active && ['available', 'printing'].includes(printer.status))
    .reduce((sum, printer) => sum + (Number.isFinite(printer.dailyCapacityHours) ? printer.dailyCapacityHours : 0), 0)
}

function normalizeStatus(status: string): number {
  const normalized = normalizeOrderStatus(status)
  if (normalized === 'queued') return 0
  if (normalized === 'printing') return 1
  if (normalized === 'post_process') return 2
  return 3
}

async function loadVolumeMaps(orderItems: { modelId?: string | null; partId?: string | null }[]) {
  const modelIds = Array.from(new Set(orderItems.map((item) => item.modelId).filter((id): id is string => Boolean(id))))
  const partIds = Array.from(new Set(orderItems.map((item) => item.partId).filter((id): id is string => Boolean(id))))
  const [models, parts] = await Promise.all([
    modelIds.length
      ? prisma.model.findMany({
          where: { id: { in: modelIds } },
          select: { id: true, volumeMm3: true },
        })
      : Promise.resolve([]),
    partIds.length
      ? prisma.modelPart.findMany({
          where: { id: { in: partIds } },
          select: { id: true, volumeMm3: true },
        })
      : Promise.resolve([]),
  ])
  return {
    modelVolumes: new Map(models.map((model) => [model.id, model.volumeMm3 ?? null])),
    partVolumes: new Map(parts.map((part) => [part.id, part.volumeMm3 ?? null])),
  }
}

function estimateOrderHours(
  items: {
    modelId?: string | null
    partId?: string | null
    material?: string | null
    infillPct?: number | null
    finish?: string | null
    quantity?: number | null
  }[],
  volumes: { modelVolumes: Map<string, number | null>; partVolumes: Map<string, number | null> },
  cfg?: Partial<SiteConfig> | null,
): number {
  return items.reduce((sum, item) => {
    const partVolume = item.partId ? volumes.partVolumes.get(item.partId) : null
    const modelVolume = item.modelId ? volumes.modelVolumes.get(item.modelId) : null
    const volumeMm3 = partVolume ?? modelVolume ?? null
    if (!volumeMm3 || !Number.isFinite(volumeMm3)) return sum
    const cm3 = volumeMm3 / 1000
    const details = estimatePricingDetails({
      cm3,
      material: item.material ?? undefined,
      infillPct: item.infillPct ?? undefined,
      finish: item.finish ?? undefined,
      cfg,
      applyMinimum: false,
    })
    const qty = typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? Math.max(1, item.quantity) : 1
    return sum + details.hours * qty
  }, 0)
}

export async function getProductionSnapshot(options: { includeCustomer?: boolean } = {}): Promise<ProductionSnapshot> {
  const includeCustomer = options.includeCustomer ?? false
  const [cfg, printers] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    prisma.printer.findMany({ orderBy: { name: 'asc' } }),
  ])
  const printerSnapshots: PrinterSnapshot[] = printers.map((printer) => ({
    id: printer.id,
    name: printer.name,
    status: printer.status,
    active: printer.active,
    dailyCapacityHours: printer.dailyCapacityHours,
    notes: printer.notes,
  }))
  const capacityHoursPerDay = resolvePrinterCapacity(printerSnapshots)
  const orders = await prisma.printOrder.findMany({
    where: { status: { in: Array.from(QUEUE_STATUSES) } },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      customerName: includeCustomer ? true : false,
      customerEmail: includeCustomer ? true : false,
      metadata: true,
      items: {
        select: {
          modelId: true,
          partId: true,
          material: true,
          infillPct: true,
          finish: true,
          quantity: true,
        },
      },
    },
  })
  const allItems = orders.flatMap((order) => order.items)
  const volumeMaps = await loadVolumeMaps(allItems)
  const paymentIntentIds = orders
    .map((order) => extractPaymentIntentId(order.metadata))
    .filter((val): val is string => Boolean(val))
  const jobForms = paymentIntentIds.length
    ? await prisma.jobForm.findMany({
        where: { paymentIntentId: { in: paymentIntentIds } },
        select: { paymentIntentId: true, status: true, lastError: true },
      })
    : []
  const jobFormMap = new Map(jobForms.map((job) => [job.paymentIntentId, job]))
  const queueEntries = orders
    .map((order) => {
      const paymentIntentId = extractPaymentIntentId(order.metadata)
      const jobForm = paymentIntentId ? jobFormMap.get(paymentIntentId) : undefined
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt,
        customerName: includeCustomer ? (order as any).customerName : undefined,
        customerEmail: includeCustomer ? (order as any).customerEmail : undefined,
        paymentIntentId,
        orderWorksStatus: jobForm?.status ?? null,
        orderWorksLastError: jobForm?.lastError ?? null,
        totalHours: estimateOrderHours(order.items, volumeMaps, cfg),
        queuePosition: null,
        estimatedCompletionAt: null,
      } satisfies OrderQueueEntry
    })
    .sort((a, b) => {
      const statusSort = normalizeStatus(a.status) - normalizeStatus(b.status)
      if (statusSort !== 0) return statusSort
      return a.createdAt.getTime() - b.createdAt.getTime()
    })

  let runningHours = 0
  const queueWithEstimates = queueEntries.map((entry, idx) => {
    runningHours += entry.totalHours
    const estimatedCompletionAt = capacityHoursPerDay > 0
      ? new Date(Date.now() + (runningHours / capacityHoursPerDay) * 24 * 60 * 60 * 1000)
      : null
    return {
      ...entry,
      queuePosition: idx + 1,
      estimatedCompletionAt,
    }
  })

  return {
    generatedAt: new Date(),
    printers: printerSnapshots,
    capacityHoursPerDay,
    queueHours: runningHours,
    orders: queueWithEstimates,
  }
}

export async function getOrderProductionSummary(orderId: string): Promise<OrderQueueEntry | null> {
  const snapshot = await getProductionSnapshot()
  return snapshot.orders.find((order) => order.id === orderId) ?? null
}

export async function getOrderProductionDetail(order: {
  id: string
  status: string
  createdAt?: Date
  metadata?: unknown
  items: {
    modelId?: string | null
    partId?: string | null
    material?: string | null
    infillPct?: number | null
    finish?: string | null
    quantity?: number | null
  }[]
}): Promise<OrderQueueEntry | null> {
  const paymentIntentId = extractPaymentIntentId(order.metadata)
  const [cfg, jobForm] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    paymentIntentId ? prisma.jobForm.findUnique({ where: { paymentIntentId } }) : Promise.resolve(null),
  ])
  const volumeMaps = await loadVolumeMaps(order.items)
  const totalHours = estimateOrderHours(order.items, volumeMaps, cfg)

  if (QUEUE_STATUSES.has(order.status)) {
    const snapshot = await getProductionSnapshot()
    const queued = snapshot.orders.find((entry) => entry.id === order.id)
    if (queued) return queued
  }

  return {
    id: order.id,
    orderNumber: null,
    status: order.status,
    createdAt: order.createdAt ?? new Date(),
    paymentIntentId,
    orderWorksStatus: jobForm?.status ?? null,
    orderWorksLastError: jobForm?.lastError ?? null,
    totalHours,
    queuePosition: null,
    estimatedCompletionAt: null,
  }
}
