import crypto from 'crypto'
import type { Prisma, PrintLabJob, PrintOrder, PrintOrderItem } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  PrintLabRequestError,
  type PrintLabJobCallbackPayload,
  type PrintLabJobRecord,
  type PrintLabJobStatus,
  submitPrintLabJob,
} from '@/lib/printlab'

type OrderWithItems = Pick<PrintOrder, 'id' | 'orderNumber' | 'paymentMethod' | 'printerId' | 'shippingMethod' | 'status' | 'metadata'> & {
  items: Array<Pick<PrintOrderItem, 'id' | 'modelId' | 'modelTitle' | 'partId' | 'partName' | 'material' | 'colors' | 'finish' | 'configuration' | 'viewerPath'>>
}

type JsonRecord = Record<string, unknown>

export type PrintLabSubmissionResult = {
  submitted: number
  failed: number
  jobs: PrintLabJob[]
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonRecord
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function buildSourceJobId(orderId: string, orderItemId: string) {
  return `mw:${orderId}:${orderItemId}`
}

export function buildPrintLabIdempotencyKey(orderId: string, orderItemId: string) {
  return sha256(`makerworks:printlab:${orderId}:${orderItemId}:v1`)
}

function getOrderPaymentIntentId(order: Pick<PrintOrder, 'metadata'>) {
  const metadata = asRecord(order.metadata)
  return asString(metadata?.paymentIntentId)
}

function getItemConfig(item: Pick<PrintOrderItem, 'configuration'>) {
  return asRecord(item.configuration)
}

function getItemStoragePath(item: Pick<PrintOrderItem, 'configuration' | 'viewerPath'>) {
  const config = getItemConfig(item)
  return asString(config?.storagePath) || asString(item.viewerPath)
}

function getItemStorageUrl(item: Pick<PrintOrderItem, 'configuration'>) {
  return asString(getItemConfig(item)?.storageUrl)
}

function normalizeHistory(raw: unknown) {
  return Array.isArray(raw) ? raw : []
}

function dedupeHistoryEntries(entries: unknown[]) {
  const seen = new Set<string>()
  const next: unknown[] = []
  for (const entry of entries) {
    const record = asRecord(entry)
    const key = JSON.stringify({
      job_id: record?.job_id ?? null,
      status: record?.status ?? null,
      updated_at: record?.updated_at ?? null,
      queue_item_id: record?.queue_item_id ?? null,
      last_error: record?.last_error ?? null,
    })
    if (seen.has(key)) continue
    seen.add(key)
    next.push(entry)
  }
  return next
}

export function mapPrintLabStatusToOrderStatus(status: string): PrintOrder['status'] {
  switch ((status || '').trim().toLowerCase()) {
    case 'queued':
      return 'queued'
    case 'started':
      return 'printing'
    case 'completed':
      return 'post_process'
    case 'cancelled':
      return 'cancelled'
    case 'failed':
    case 'submit_failed':
      return 'failed'
    default:
      return 'queued'
  }
}

function deriveOrderFailureNote(status: string, message?: string | null) {
  const detail = asString(message)
  if (status === 'submit_failed') {
    return detail || 'PrintLab submission failed and needs operator attention.'
  }
  if (status === 'failed') {
    return detail || 'PrintLab reported a print failure.'
  }
  if (status === 'cancelled') {
    return detail || 'PrintLab reported the job as cancelled.'
  }
  return null
}

async function resolvePrinterAssignment(printLabPrinterId?: string | null, printLabPrinterName?: string | null) {
  const externalId = asString(printLabPrinterId)
  const name = asString(printLabPrinterName)
  if (!externalId && !name) return null
  return prisma.printer.findFirst({
    where: {
      OR: [
        ...(externalId ? [{ id: externalId }, { externalId }] : []),
        ...(name ? [{ name }] : []),
      ],
    },
    select: { id: true, name: true },
  })
}

async function loadOrderForPrintLab(orderId: string): Promise<OrderWithItems | null> {
  return prisma.printOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      paymentMethod: true,
      printerId: true,
      shippingMethod: true,
      status: true,
      metadata: true,
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          modelId: true,
          modelTitle: true,
          partId: true,
          partName: true,
          material: true,
          colors: true,
          finish: true,
          configuration: true,
          viewerPath: true,
        },
      },
    },
  }) as Promise<OrderWithItems | null>
}

export async function ensurePrintLabJobsForOrder(orderId: string) {
  const order = await loadOrderForPrintLab(orderId)
  if (!order) return []
  const paymentIntentId = getOrderPaymentIntentId(order)
  const existing = await prisma.printLabJob.findMany({
    where: { orderId },
    select: { id: true, orderItemId: true },
  })
  const existingByItemId = new Map(existing.map((job) => [job.orderItemId, job.id]))
  const creates = order.items
    .filter((item) => !existingByItemId.has(item.id))
    .map((item) => {
      const modelId = item.partId || item.modelId || item.id
      const modelName = item.partName ? `${item.modelTitle} (${item.partName})` : item.modelTitle
      const sourceJobId = buildSourceJobId(order.id, item.id)
      const storagePath = getItemStoragePath(item)
      const storageUrl = getItemStorageUrl(item)
      const metadata: Prisma.InputJsonValue = {
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        material: item.material,
        colors: item.colors ?? null,
        finish: item.finish ?? null,
        storagePath: storagePath || null,
        storageUrl: storageUrl || null,
      }
      return prisma.printLabJob.create({
        data: {
          orderId: order.id,
          orderItemId: item.id,
          paymentIntentId: paymentIntentId || undefined,
          sourceJobId,
          idempotencyKey: buildPrintLabIdempotencyKey(order.id, item.id),
          modelId,
          modelName,
          filePath: storagePath || undefined,
          metadata,
        },
      })
    })
  if (creates.length > 0) {
    await prisma.$transaction(creates)
  }
  return prisma.printLabJob.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
  })
}

function buildSubmitPayload(order: OrderWithItems, item: OrderWithItems['items'][number], job: PrintLabJob) {
  const itemConfig = getItemConfig(item)
  const amsMappingRaw = Array.isArray(itemConfig?.amsMapping) ? itemConfig?.amsMapping : []
  const amsMapping = amsMappingRaw
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0)
  const startAt = asString(itemConfig?.startAt)
  const plateGcode = asString(itemConfig?.plateGcode)
  const orderMetadata = asRecord(order.metadata)
  return {
    model_id: job.modelId,
    printer_id: order.printerId || undefined,
    idempotency_key: job.idempotencyKey,
    source_job_id: job.sourceJobId,
    source_order_id: order.id,
    start_at: startAt || undefined,
    plate_gcode: plateGcode || undefined,
    use_ams: itemConfig?.useAms !== false,
    ams_mapping: amsMapping.length > 0 ? amsMapping : [0],
    bed_type: asString(itemConfig?.bedType) || 'auto',
    timelapse: Boolean(itemConfig?.timelapse),
    bed_leveling: itemConfig?.bedLeveling !== false,
    flow_cali: itemConfig?.flowCali !== false,
    vibration_cali: itemConfig?.vibrationCali !== false,
    layer_inspect: itemConfig?.layerInspect !== false,
    metadata: {
      source: 'makerworks',
      order_id: order.id,
      order_number: order.orderNumber,
      order_item_id: item.id,
      payment_intent_id: job.paymentIntentId,
      model_title: item.modelTitle,
      part_name: item.partName,
      material: item.material,
      colors: item.colors ?? null,
      finish: item.finish ?? null,
      shipping_method: order.shippingMethod,
      rush: orderMetadata?.rush === true,
    },
  }
}

async function persistSubmissionResponse(localJobId: string, upstream: PrintLabJobRecord) {
  return prisma.printLabJob.update({
    where: { id: localJobId },
    data: {
      printLabJobId: upstream.id,
      status: asString(upstream.status) || 'queued',
      printerId: asString(upstream.printer_id) || undefined,
      printerName: asString(upstream.printer_name) || undefined,
      queueItemId: asString(upstream.queue_item_id) || undefined,
      modelName: asString(upstream.model_name) || undefined,
      filePath: asString(upstream.file_path) || undefined,
      fileName: asString(upstream.file_name) || undefined,
      lastSubmittedAt: new Date(),
      lastError: null,
      history: normalizeHistory(upstream.history) as Prisma.InputJsonValue,
    },
  })
}

async function persistSubmissionFailure(localJobId: string, error: unknown) {
  const message = error instanceof PrintLabRequestError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Unknown PrintLab submission error'
  return prisma.printLabJob.update({
    where: { id: localJobId },
    data: {
      status: 'submit_failed',
      lastSubmittedAt: new Date(),
      lastError: message,
    },
  })
}

export async function submitPrintLabJobsForOrder(orderId: string): Promise<PrintLabSubmissionResult> {
  const order = await loadOrderForPrintLab(orderId)
  if (!order) return { submitted: 0, failed: 0, jobs: [] }
  const jobs = await ensurePrintLabJobsForOrder(orderId)
  let submitted = 0
  let failed = 0
  const nextJobs: PrintLabJob[] = []

  for (const job of jobs) {
    const item = order.items.find((entry) => entry.id === job.orderItemId)
    if (!item) {
      nextJobs.push(job)
      continue
    }
    if (job.printLabJobId && ['queued', 'started', 'completed'].includes(job.status)) {
      nextJobs.push(job)
      continue
    }
    try {
      await prisma.printLabJob.update({
        where: { id: job.id },
        data: { submitAttempts: { increment: 1 }, lastSubmittedAt: new Date() },
      })
      const upstream = await submitPrintLabJob(buildSubmitPayload(order, item, job))
      const updated = await persistSubmissionResponse(job.id, upstream)
      nextJobs.push(updated)
      submitted += 1
    } catch (error) {
      failed += 1
      const updated = await persistSubmissionFailure(job.id, error)
      nextJobs.push(updated)
    }
  }

  return { submitted, failed, jobs: nextJobs }
}

export async function resubmitPrintLabJobById(localJobId: string) {
  const job = await prisma.printLabJob.findUnique({
    where: { id: localJobId },
    select: { orderId: true },
  })
  if (!job) return null
  await prisma.printLabJob.update({
    where: { id: localJobId },
    data: {
      printLabJobId: null,
      queueItemId: null,
      lastError: null,
      status: 'pending_submission',
    },
  })
  const result = await submitPrintLabJobsForOrder(job.orderId)
  return result.jobs.find((entry) => entry.id === localJobId) || null
}

async function syncOrderFromPrintLabJob(job: PrintLabJob, payload: PrintLabJobCallbackPayload) {
  const nextStatus = mapPrintLabStatusToOrderStatus(payload.status)
  const localPrinter = await resolvePrinterAssignment(payload.printer_id, payload.printer_name)
  const printerAssignedAt = payload.status === 'started' || payload.status === 'completed'
    ? asDate(payload.started_at) || new Date()
    : null
  const failureNote = deriveOrderFailureNote(payload.status, payload.last_error)

  await prisma.printOrder.update({
    where: { id: job.orderId },
    data: {
      status: nextStatus,
      failedAt: nextStatus === 'failed' ? (asDate(payload.updated_at) || new Date()) : null,
      failureNote: failureNote || null,
      printerId: localPrinter?.id || undefined,
      printerAssignedAt: printerAssignedAt || (nextStatus === 'queued' ? null : undefined),
      printerAssignedBy: localPrinter?.id ? 'printlab' : undefined,
    },
  })
}

export async function handlePrintLabCallback(jobIdFromRoute: string, payload: PrintLabJobCallbackPayload) {
  const externalJobId = asString(payload.job_id) || jobIdFromRoute
  const job = await prisma.printLabJob.findFirst({
    where: {
      OR: [
        { printLabJobId: externalJobId },
        { sourceJobId: jobIdFromRoute },
      ],
    },
  })
  if (!job) return null

  const mergedHistory = dedupeHistoryEntries([
    ...normalizeHistory(job.history),
    payload,
  ])
  const previousUpdatedAt = asRecord(job.lastCallbackPayload)?.updated_at
  const isDuplicate =
    asString(previousUpdatedAt) === asString(payload.updated_at)
    && job.status === payload.status
    && (job.queueItemId || null) === (asString(payload.queue_item_id) || null)

  const updated = await prisma.printLabJob.update({
    where: { id: job.id },
    data: {
      printLabJobId: externalJobId,
      status: payload.status,
      printerId: asString(payload.printer_id) || undefined,
      printerName: asString(payload.printer_name) || undefined,
      queueItemId: asString(payload.queue_item_id) || undefined,
      successfulGcodeId: asString(payload.successful_gcode_id) || undefined,
      modelName: asString(payload.model_name) || undefined,
      modelUrl: asString(payload.model_url) || undefined,
      downloadUrl: asString(payload.download_url) || undefined,
      filePath: asString(payload.file_path) || undefined,
      fileName: asString(payload.file_name) || undefined,
      plateGcode: asString(payload.plate_gcode) || undefined,
      startAt: asDate(payload.start_at) || undefined,
      lastCallbackAt: new Date(),
      startedAt: asDate(payload.started_at) || undefined,
      completedAt: asDate(payload.completed_at) || undefined,
      callbackCount: isDuplicate ? job.callbackCount : { increment: 1 },
      lastError: asString(payload.last_error) || null,
      metadata: payload.metadata ? (payload.metadata as Prisma.InputJsonValue) : undefined,
      lastCallbackPayload: payload as unknown as Prisma.InputJsonValue,
      history: mergedHistory as Prisma.InputJsonValue,
    },
  })

  await syncOrderFromPrintLabJob(updated, payload)
  return updated
}

export function summarizePrintLabJobs(jobs: Array<{
  printLabJobId: string | null
  status: string
  printerId: string | null
  printerName: string | null
  lastCallbackAt: Date | null
  updatedAt: Date
  lastError: string | null
}>) {
  if (!jobs.length) return null
  const latest = [...jobs].sort((a, b) => {
    const aAt = a.lastCallbackAt?.getTime() || a.updatedAt.getTime()
    const bAt = b.lastCallbackAt?.getTime() || b.updatedAt.getTime()
    return bAt - aAt
  })[0]
  const failureCount = jobs.filter((job) => ['failed', 'submit_failed'].includes(job.status)).length
  return {
    latestStatus: latest.status,
    latestJobId: latest.printLabJobId,
    latestPrinterName: latest.printerName,
    latestPrinterId: latest.printerId,
    latestError: latest.lastError,
    queuedCount: jobs.filter((job) => job.status === 'queued').length,
    activeCount: jobs.filter((job) => job.status === 'started').length,
    completedCount: jobs.filter((job) => job.status === 'completed').length,
    failureCount,
  }
}
