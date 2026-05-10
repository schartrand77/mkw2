import { prisma } from '@/lib/db'
import { estimatePricingDetails } from '@/lib/pricing'
import { mapFulfillmentToOrderStatus, normalizeOrderStatus, type FulfillmentStatusKey } from '@/lib/order-status'
import { extractJobFormId, extractOrderId, extractPaymentIntentId, findLinkedJobsForOrder } from '@/lib/orderworks-link'
import type { Prisma, SiteConfig } from '@prisma/client'
import { isPaidPaymentStatus } from '@/lib/orderworks-status'

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
  metadata?: unknown
  lastSeenAt?: Date | null
}

type OrderQueueEntry = {
  id: string
  orderNumber: number | null
  status: string
  createdAt: Date
  customerName?: string | null
  customerEmail?: string | null
  paymentMethod?: string | null
  paymentStatus?: string | null
  totalCents?: number | null
  currency?: string | null
  contributionType?: string | null
  donatedAmountCents?: number | null
  receiptStatus?: string | null
  contributionNotes?: string | null
  lineItems?: ProductionLineItemSummary[]
  lastPrintLabSubmission?: PrintLabSubmissionSummary | null
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
  etaConfidenceScore: number | null
  milestones?: ProductionMilestone[]
}

export type ProductionQueueClientJob = {
  id: string
  orderNumber: number | null
  orderLabel: string
  status: string
  createdAt: string
  customerName?: string | null
  customerEmail?: string | null
  paymentMethod?: string | null
  paymentStatus?: string | null
  totalCents?: number | null
  currency?: string | null
  contributionType?: string | null
  donatedAmountCents?: number | null
  contributionSummary: string | null
  lineItems?: ProductionLineItemSummary[]
  printLabStatus: string | null
  printLabPrinterName: string | null
  printLabJobId: string | null
  printLabError: string | null
  legacyJobStatus: string | null
  legacyJobError: string | null
  printerName?: string | null
  totalHours: number
  queuePosition: number | null
  estimatedCompletionAt: string | null
}

export type ProductionQueueClientSnapshot = {
  generatedAt: string
  jobs: ProductionQueueClientJob[]
  activeCount: number
  totalCount: number
  queueHours: number
}

export type ProductionLineItemSummary = {
  modelTitle: string
  material: string | null
  quantity: number
  totalCents: number
}

export type PrintLabSubmissionSummary = {
  status: string | null
  printerName: string | null
  printLabJobId: string | null
  error: string | null
}

type PrintLabCallbackPayload = {
  job_id?: unknown
  status?: unknown
  printer_id?: unknown
  printer_name?: unknown
  queue_item_id?: unknown
  successful_gcode_id?: unknown
  idempotency_key?: unknown
  source_job_id?: unknown
  source_order_id?: unknown
  model_id?: unknown
  model_name?: unknown
  completed_at?: unknown
  started_at?: unknown
  updated_at?: unknown
  last_error?: unknown
  progress_percent?: unknown
}

export type ProductionMilestone = {
  key: string
  label: string
  state: 'complete' | 'current' | 'upcoming'
  at: Date | null
  detail?: string | null
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function asRecord(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, any>
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function formatProductionMoney(cents?: number | null, currency?: string | null) {
  const amount = Math.max(0, Number.isFinite(Number(cents)) ? Number(cents) : 0) / 100
  const code = (currency || 'USD').toUpperCase()
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${code} ${amount.toFixed(2)}`
  }
}

export function describeProductionContribution(order: {
  contributionType?: string | null
  paymentMethod?: string | null
  donatedAmountCents?: number | null
  totalCents?: number | null
  currency?: string | null
}) {
  const type = String(order.contributionType || 'paid').trim().toLowerCase()
  const valueCents = typeof order.donatedAmountCents === 'number' ? order.donatedAmountCents : order.totalCents
  const value = formatProductionMoney(valueCents, order.currency)
  if (type === 'paid' && (String(order.paymentMethod || '').trim().toLowerCase() === 'comped' || Number(order.totalCents) === 0)) {
    return `No-charge contribution: ${value}`
  }
  if (type === 'paid') return null
  if (type === 'donated') return `Donated production work: ${value}`
  if (type === 'discounted') return `Discounted community work: ${value}`
  if (type === 'cost_only') return `Cost-only production: ${value}`
  if (type === 'sponsored') return `Sponsored production: ${value}`
  return `Community contribution: ${value}`
}

export function extractPrintLabSubmissionSummary(metadata: unknown): PrintLabSubmissionSummary | null {
  const record = asRecord(metadata)
  const submission = asRecord(record?.lastPrintLabSubmission)
  if (!submission) return null
  return {
    status: readString(submission.status),
    printerName: readString(submission.printerName),
    printLabJobId: readString(submission.printLabJobId),
    error: readString(submission.error),
  }
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function deriveOrderStatusFromPrintLabStatus(printLabStatus: unknown, currentStatus: string) {
  const current = normalizeOrderStatus(currentStatus)
  if (current === 'completed' || current === 'shipped' || current === 'cancelled') return current
  const status = String(printLabStatus || '').trim().toLowerCase()
  if (status === 'started') return 'printing'
  if (status === 'completed') return 'completed'
  if (status === 'failed' || status === 'cancelled' || status === 'submit_failed') return 'failed'
  return current
}

export function mergePrintLabCallbackMetadata(
  metadata: unknown,
  payload: PrintLabCallbackPayload,
  receivedAt = new Date().toISOString(),
): Record<string, unknown> {
  const prior = asRecord(metadata) || {}
  const jobId = readString(payload.job_id)
  const entry = {
    at: receivedAt,
    source: 'printlab_callback',
    printLabJobId: jobId,
    status: readString(payload.status),
    printerId: readString(payload.printer_id),
    printerName: readString(payload.printer_name),
    queueItemId: readString(payload.queue_item_id),
    successfulGcodeId: readString(payload.successful_gcode_id),
    idempotencyKey: readString(payload.idempotency_key),
    sourceJobId: readString(payload.source_job_id),
    sourceOrderId: readString(payload.source_order_id),
    modelId: readString(payload.model_id),
    modelName: readString(payload.model_name),
    startedAt: readString(payload.started_at),
    completedAt: readString(payload.completed_at),
    updatedAt: readString(payload.updated_at),
    progressPercent: readNumber(payload.progress_percent),
    error: readString(payload.last_error),
  }
  const priorSubmissions = Array.isArray(prior.printLabSubmissions) ? prior.printLabSubmissions : []
  let matched = false
  const printLabSubmissions = priorSubmissions.map((item) => {
    const record = asRecord(item)
    if (!record) return item
    const existingId = readString(record.printLabJobId) || readString(record.jobId) || readString(record.id)
    if (jobId && existingId === jobId) {
      matched = true
      return { ...record, ...entry }
    }
    return item
  })
  if (!matched) printLabSubmissions.push(entry)
  return {
    ...prior,
    printLabSubmissions,
    lastPrintLabSubmission: entry,
  }
}

function parseDateValue(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function extractShippingInfo(metadata: unknown) {
  const record = asRecord(metadata)
  const shipping = asRecord(record?.shippingInfo)
  return {
    carrier: typeof shipping?.carrier === 'string' ? shipping.carrier : null,
    service: typeof shipping?.service === 'string' ? shipping.service : null,
    trackingNumber: typeof shipping?.trackingNumber === 'string' ? shipping.trackingNumber : null,
    shippedAt: parseDateValue(shipping?.shippedAt),
    updatedAt: parseDateValue(shipping?.updatedAt),
  }
}

function extractPackingProgress(metadata: unknown) {
  const record = asRecord(metadata)
  const packing = asRecord(record?.packingChecklist)
  const items = Array.isArray(packing?.items) ? packing?.items : []
  const packedCount = items.filter((item) => asRecord(item)?.status === 'packed').length
  return {
    total: items.length,
    packedCount,
    allPacked: items.length > 0 && packedCount === items.length,
    updatedAt: parseDateValue(packing?.updatedAt),
  }
}

function extractSlicerVerification(metadata: unknown) {
  const record = asRecord(metadata)
  const slicerStats = asRecord(record?.slicerStats)
  return {
    profileUploadedAt: parseDateValue(record?.slicerProfileUploadedAt),
    statsUpdatedAt: parseDateValue(slicerStats?.updatedAt),
    profileName: typeof record?.slicerProfileName === 'string' ? record.slicerProfileName : null,
  }
}

function buildMilestones(args: {
  status: string
  shippingMethod?: string | null
  createdAt: Date
  updatedAt?: Date | null
  printerAssignedAt?: Date | null
  metadata?: unknown
  jobStatus?: string | null
  fulfilledAt?: Date | null
}) {
  const normalized = normalizeOrderStatus(args.status)
  const shippingMethod = (args.shippingMethod || 'pickup').toLowerCase()
  const shippingInfo = extractShippingInfo(args.metadata)
  const packing = extractPackingProgress(args.metadata)
  const slicer = extractSlicerVerification(args.metadata)
  const slicerAt = slicer.profileUploadedAt || slicer.statsUpdatedAt
  const packedAt = packing.allPacked ? (packing.updatedAt || shippingInfo.shippedAt || args.updatedAt || null) : null
  const shippedAt = shippingMethod === 'ship' ? (shippingInfo.shippedAt || args.fulfilledAt || null) : args.fulfilledAt || null

  const stageIndex = (() => {
    if (shippingMethod === 'ship' && (normalized === 'shipped' || normalized === 'completed')) return 5
    if (shippingMethod !== 'ship' && normalized === 'completed') return 5
    if (packing.allPacked) return 4
    if (normalized === 'post_process') return 3
    if (normalized === 'printing') return 2
    if (slicerAt || (args.jobStatus || '').trim().toLowerCase() === 'sent') return 1
    return 0
  })()

  const finalLabel = shippingMethod === 'ship' ? 'Shipped' : normalized === 'completed' ? 'Picked up' : 'Ready for pickup'
  const finalDetail = shippingMethod === 'ship'
    ? (shippingInfo.trackingNumber ? `Tracking ${shippingInfo.trackingNumber}` : 'Carrier handoff complete.')
    : 'Your order is finished and awaiting pickup.'

  const milestones: Array<{ key: string; label: string; completeAt: Date | null; detail?: string | null; forceComplete?: boolean }> = [
    {
      key: 'queued',
      label: 'Queued',
      completeAt: args.createdAt,
      detail: 'Order entered the production queue.',
      forceComplete: true,
    },
    {
      key: 'slicing_verified',
      label: 'Slicing verified',
      completeAt: slicerAt,
      detail: slicer.profileName ? `Profile attached: ${slicer.profileName}` : 'Toolpaths and production settings confirmed.',
    },
    {
      key: 'on_printer',
      label: 'On printer',
      completeAt: args.printerAssignedAt || null,
      detail: args.printerAssignedAt ? 'Printer assigned and production started.' : 'Waiting for printer assignment.',
    },
    {
      key: 'post_process',
      label: 'Post-process',
      completeAt: normalized === 'post_process' || stageIndex > 3 ? (args.updatedAt || null) : null,
      detail: 'Support removal, cleanup, and quality checks.',
    },
    {
      key: 'packed',
      label: 'Packed',
      completeAt: packedAt,
      detail: packing.total > 0 ? `${packing.packedCount}/${packing.total} checklist items packed.` : 'Packing checklist pending.',
    },
    {
      key: shippingMethod === 'ship' ? 'shipped' : 'ready_for_pickup',
      label: finalLabel,
      completeAt: shippedAt,
      detail: finalDetail,
    },
  ]

  let currentAssigned = false
  return milestones.map((milestone, index) => {
    const complete = Boolean(milestone.forceComplete || milestone.completeAt || stageIndex > index)
    if (complete) {
      return {
        key: milestone.key,
        label: milestone.label,
        state: 'complete',
        at: milestone.completeAt,
        detail: milestone.detail,
      } satisfies ProductionMilestone
    }
    if (!currentAssigned) {
      currentAssigned = true
      return {
        key: milestone.key,
        label: milestone.label,
        state: 'current',
        at: milestone.completeAt,
        detail: milestone.detail,
      } satisfies ProductionMilestone
    }
    return {
      key: milestone.key,
      label: milestone.label,
      state: 'upcoming',
      at: milestone.completeAt,
      detail: milestone.detail,
    } satisfies ProductionMilestone
  })
}

function estimateEtaConfidenceScore(entry: { status: string; queuePosition: number | null; orderWorksLastError?: string | null }, capacityHoursPerDay: number) {
  let score = capacityHoursPerDay > 0 ? 0.82 : 0.45
  const normalized = normalizeOrderStatus(entry.status)
  if (normalized === 'printing') score += 0.1
  if (normalized === 'post_process') score += 0.12
  if (normalized === 'queued' && (entry.queuePosition ?? 0) > 6) score -= 0.1
  if (entry.orderWorksLastError) score -= 0.15
  return Math.round(clamp(score, 0.2, 0.98) * 100) / 100
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
    metadata: printer.metadata,
    lastSeenAt: printer.lastSeenAt,
  }))
  const capacityHoursPerDay = resolvePrinterCapacity(printerSnapshots)
  const orderWorks = orderWorksJobs.reduce(
    (acc, job) => {
      const status = (job.status || '').toLowerCase()
      if (status === 'sent') acc.sentJobs += 1
      else acc.pendingJobs += 1
      if (!isPaidPaymentStatus(job.paymentStatus)) acc.unpaidJobs += 1
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
      paymentMethod: true,
      paymentStatus: true,
      totalCents: true,
      currency: true,
      contributionType: true,
      donatedAmountCents: true,
      receiptStatus: true,
      contributionNotes: true,
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
          modelTitle: true,
          totalCents: true,
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
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        totalCents: order.totalCents,
        currency: order.currency,
        contributionType: order.contributionType,
        donatedAmountCents: order.donatedAmountCents,
        receiptStatus: order.receiptStatus,
        contributionNotes: order.contributionNotes,
        lineItems: order.items.map((item) => ({
          modelTitle: item.modelTitle,
          material: item.material ?? null,
          quantity: item.quantity,
          totalCents: item.totalCents,
        })),
        lastPrintLabSubmission: extractPrintLabSubmissionSummary(order.metadata),
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
        etaConfidenceScore: null,
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
      etaConfidenceScore: estimateEtaConfidenceScore({ ...entry, queuePosition: idx + 1 }, capacityHoursPerDay),
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

function productionOrderLabel(orderNumber: number | null) {
  return orderNumber ? `MW-${orderNumber.toString().padStart(5, '0')}` : 'Draft order'
}

export function buildProductionQueueClientSnapshot(snapshot: ProductionSnapshot): ProductionQueueClientSnapshot {
  const jobs = snapshot.orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    orderLabel: productionOrderLabel(order.orderNumber),
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    customerName: order.customerName ?? null,
    customerEmail: order.customerEmail ?? null,
    paymentMethod: order.paymentMethod ?? null,
    paymentStatus: order.paymentStatus ?? null,
    totalCents: order.totalCents ?? null,
    currency: order.currency ?? null,
    contributionType: order.contributionType ?? null,
    donatedAmountCents: order.donatedAmountCents ?? null,
    contributionSummary: describeProductionContribution(order),
    lineItems: order.lineItems ?? [],
    printLabStatus: order.lastPrintLabSubmission?.status ?? null,
    printLabPrinterName: order.lastPrintLabSubmission?.printerName ?? null,
    printLabJobId: order.lastPrintLabSubmission?.printLabJobId ?? null,
    printLabError: order.lastPrintLabSubmission?.error ?? null,
    legacyJobStatus: order.orderWorksStatus ?? null,
    legacyJobError: order.orderWorksLastError ?? null,
    printerName: order.printerName ?? null,
    totalHours: order.totalHours,
    queuePosition: order.queuePosition,
    estimatedCompletionAt: order.estimatedCompletionAt ? order.estimatedCompletionAt.toISOString() : null,
  }))

  return {
    generatedAt: snapshot.generatedAt.toISOString(),
    jobs,
    activeCount: jobs.length,
    totalCount: jobs.length,
    queueHours: snapshot.queueHours,
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
  updatedAt?: Date
  shippingMethod?: string | null
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
  const liveOrder = await prisma.printOrder.findUnique({
    where: { id: order.id },
    select: {
      metadata: true,
      printerAssignedAt: true,
      shippingMethod: true,
      updatedAt: true,
    },
  })
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
    if (queued) {
      const liveOrder = await prisma.printOrder.findUnique({
        where: { id: order.id },
        select: {
          metadata: true,
          printerAssignedAt: true,
          shippingMethod: true,
          updatedAt: true,
        },
      })
      return {
        ...queued,
        milestones: buildMilestones({
          status: queued.status,
          shippingMethod: liveOrder?.shippingMethod || order.shippingMethod,
          createdAt: order.createdAt ?? queued.createdAt,
          updatedAt: liveOrder?.updatedAt || order.updatedAt || null,
          printerAssignedAt: liveOrder?.printerAssignedAt || null,
          metadata: liveOrder?.metadata || order.metadata,
          jobStatus: queued.orderWorksStatus ?? null,
          fulfilledAt: jobForm?.fulfilledAt ?? null,
        }),
      }
    }
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
    etaConfidenceScore: null,
    milestones: buildMilestones({
      status: effectiveStatus,
      shippingMethod: liveOrder?.shippingMethod || order.shippingMethod,
      createdAt: order.createdAt ?? new Date(),
      updatedAt: liveOrder?.updatedAt || order.updatedAt || null,
      printerAssignedAt: liveOrder?.printerAssignedAt || null,
      metadata: liveOrder?.metadata || order.metadata,
      jobStatus: jobForm?.status ?? null,
      fulfilledAt: jobForm?.fulfilledAt ?? null,
    }),
  }
}
