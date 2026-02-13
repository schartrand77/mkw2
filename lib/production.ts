import { prisma } from '@/lib/db'
import { estimatePricingDetails } from '@/lib/pricing'
import { mapFulfillmentToOrderStatus, normalizeOrderStatus, type FulfillmentStatusKey } from '@/lib/order-status'
import { extractJobFormId, extractOrderId, extractPaymentIntentId, findLinkedJobsForOrder } from '@/lib/orderworks-link'
import type { Prisma, SiteConfig } from '@prisma/client'

const QUEUE_STATUSES = new Set([
  'queued',
  'printing',
  'post_process',
  'failed',
  'awaiting_review',
  'awaiting_payment',
  'in_production',
  'ready',
])
const ACTIVE_FLOW_STATUSES = new Set(['queued', 'printing', 'post_process', 'failed'])

type PrinterSnapshot = {
  id: string
  name: string
  status: string
  active: boolean
  dailyCapacityHours: number
  notes?: string | null
  provider?: string | null
  externalId?: string | null
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
  printerId?: string | null
  printerName?: string | null
  failedAt?: Date | null
  failureNote?: string | null
  totalHours: number
  queuePosition: number | null
  estimatedCompletionAt: Date | null
}

type OrderWorksSummary = {
  totalJobs: number
  sentJobs: number
  pendingJobs: number
  unpaidJobs: number
}

export type ProductionSnapshot = {
  generatedAt: Date
  printers: PrinterSnapshot[]
  capacityHoursPerDay: number
  queueHours: number
  orderWorks: OrderWorksSummary
  orders: OrderQueueEntry[]
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
  if (normalized === 'failed') return 2
  if (normalized === 'post_process') return 3
  return 4
}

function isPaidPaymentStatus(paymentStatus?: string | null) {
  const normalized = (paymentStatus || '').trim().toLowerCase()
  if (!normalized) return false
  return normalized === 'paid'
    || normalized === 'succeeded'
    || normalized === 'free'
    || normalized === 'processing'
    || normalized === 'requires_capture'
}

function resolveOrderStatusFromFulfillment(
  orderStatus: string,
  fulfillmentStatus?: FulfillmentStatusKey | null,
  fulfilledAt?: Date | null,
  jobStatus?: string | null,
  paymentStatus?: string | null,
) {
  const normalizedJobStatus = (jobStatus || '').trim().toLowerCase()
  if (fulfilledAt || normalizedJobStatus === 'completed' || normalizedJobStatus === 'fulfilled' || normalizedJobStatus === 'done') {
    return 'completed'
  }
  if (paymentStatus !== undefined && paymentStatus !== null && !isPaidPaymentStatus(paymentStatus)) {
    return 'awaiting_payment'
  }
  if (!fulfillmentStatus) return orderStatus
  const mapped = mapFulfillmentToOrderStatus(fulfillmentStatus)
  if (mapped === 'completed' || mapped === 'shipped') return mapped
  if (mapped === 'post_process') return 'post_process'
  return orderStatus
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
  const [cfg, printers, orderWorksJobs] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    prisma.printer.findMany({ orderBy: { name: 'asc' } }),
    prisma.jobForm.findMany({
      select: {
        status: true,
        paymentStatus: true,
      },
    }),
  ])
  const printerSnapshots: PrinterSnapshot[] = printers.map((printer) => ({
    id: printer.id,
    name: printer.name,
    status: printer.status,
    active: printer.active,
    dailyCapacityHours: printer.dailyCapacityHours,
    notes: printer.notes,
    provider: printer.provider,
    externalId: printer.externalId,
  }))
  const capacityHoursPerDay = resolvePrinterCapacity(printerSnapshots)
  const paidStatuses = new Set(['paid', 'succeeded', 'free', 'processing', 'requires_capture'])
  const orderWorks = orderWorksJobs.reduce(
    (acc, job) => {
      const status = (job.status || '').toLowerCase()
      if (status === 'sent') acc.sentJobs += 1
      else acc.pendingJobs += 1
      const paymentStatus = (job.paymentStatus || '').trim().toLowerCase()
      if (!paymentStatus || !paidStatuses.has(paymentStatus)) acc.unpaidJobs += 1
      acc.totalJobs += 1
      return acc
    },
    { totalJobs: 0, sentJobs: 0, pendingJobs: 0, unpaidJobs: 0 } satisfies OrderWorksSummary,
  )
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
      printerId: true,
      printer: { select: { id: true, name: true } },
      failedAt: true,
      failureNote: true,
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
  const paymentIntentIds = Array.from(
    new Set(
      orders
        .map((order) => extractPaymentIntentId(order.metadata))
        .filter((val): val is string => Boolean(val)),
    ),
  )
  const jobFormIds = Array.from(
    new Set(
      orders
        .map((order) => extractJobFormId(order.metadata))
        .filter((val): val is string => Boolean(val)),
    ),
  )
  const orderIds = orders.map((order) => order.id)
  const jobWhere: Prisma.JobFormWhereInput[] = [
    ...orderIds.map((orderId) => ({ metadata: { path: ['orderId'], equals: orderId } })),
  ]
  if (paymentIntentIds.length > 0) jobWhere.push({ paymentIntentId: { in: paymentIntentIds } })
  if (jobFormIds.length > 0) jobWhere.push({ id: { in: jobFormIds } })
  const jobForms = await prisma.jobForm.findMany({
    where: { OR: jobWhere },
    select: { id: true, paymentIntentId: true, status: true, paymentStatus: true, lastError: true, fulfillmentStatus: true, fulfilledAt: true, metadata: true, createdAt: true },
  })

  const jobsByOrderId = new Map<string, typeof jobForms>()
  const jobsByPaymentIntentId = new Map<string, typeof jobForms>()
  const jobsById = new Map(jobForms.map((job) => [job.id, job]))

  for (const job of jobForms) {
    if (job.paymentIntentId) {
      const existing = jobsByPaymentIntentId.get(job.paymentIntentId) || []
      existing.push(job)
      jobsByPaymentIntentId.set(job.paymentIntentId, existing)
    }
    const linkedOrderId = extractOrderId(job.metadata)
    if (linkedOrderId) {
      const existing = jobsByOrderId.get(linkedOrderId) || []
      existing.push(job)
      jobsByOrderId.set(linkedOrderId, existing)
    }
  }

  function getLatestJobForOrder(orderId: string, metadata: unknown) {
    const linked = new Map<string, (typeof jobForms)[number]>()
    for (const job of jobsByOrderId.get(orderId) || []) linked.set(job.id, job)
    const paymentIntentId = extractPaymentIntentId(metadata)
    if (paymentIntentId) {
      for (const job of jobsByPaymentIntentId.get(paymentIntentId) || []) linked.set(job.id, job)
    }
    const jobFormId = extractJobFormId(metadata)
    if (jobFormId && jobsById.has(jobFormId)) linked.set(jobFormId, jobsById.get(jobFormId)!)
    return Array.from(linked.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
  }

  const queueEntries = orders
    .map((order) => {
      const paymentIntentId = extractPaymentIntentId(order.metadata)
      const jobForm = getLatestJobForOrder(order.id, order.metadata)
      const status = resolveOrderStatusFromFulfillment(
        order.status,
        jobForm?.fulfillmentStatus ?? null,
        jobForm?.fulfilledAt ?? null,
        jobForm?.status ?? null,
        jobForm?.paymentStatus ?? null,
      )
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status,
        createdAt: order.createdAt,
        customerName: includeCustomer ? (order as any).customerName : undefined,
        customerEmail: includeCustomer ? (order as any).customerEmail : undefined,
        paymentIntentId,
        orderWorksStatus: jobForm?.status ?? null,
        orderWorksLastError: jobForm?.lastError ?? null,
        printerId: order.printerId,
        printerName: order.printer?.name ?? null,
        failedAt: order.failedAt ?? null,
        failureNote: order.failureNote ?? null,
        totalHours: estimateOrderHours(order.items, volumeMaps, cfg),
        queuePosition: null,
        estimatedCompletionAt: null,
      } satisfies OrderQueueEntry
    })
    .filter((entry) => ACTIVE_FLOW_STATUSES.has(normalizeOrderStatus(entry.status)))
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
    orderWorks,
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
  const [cfg, linkedJobs] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    findLinkedJobsForOrder(order.id, order.metadata),
  ])
  const jobForm = linkedJobs[0]
  const volumeMaps = await loadVolumeMaps(order.items)
  const totalHours = estimateOrderHours(order.items, volumeMaps, cfg)
  const effectiveStatus = resolveOrderStatusFromFulfillment(
    order.status,
    jobForm?.fulfillmentStatus ?? null,
    jobForm?.fulfilledAt ?? null,
    jobForm?.status ?? null,
    jobForm?.paymentStatus ?? null,
  )

  if (QUEUE_STATUSES.has(order.status)) {
    const snapshot = await getProductionSnapshot()
    const queued = snapshot.orders.find((entry) => entry.id === order.id)
    if (queued) return queued
  }

  return {
    id: order.id,
    orderNumber: null,
    status: effectiveStatus,
    createdAt: order.createdAt ?? new Date(),
    paymentIntentId,
    orderWorksStatus: jobForm?.status ?? null,
    orderWorksLastError: jobForm?.lastError ?? null,
    totalHours,
    queuePosition: null,
    estimatedCompletionAt: null,
  }
}
