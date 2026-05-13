import { deriveOrderStatusFromPrintLabStatus } from './production'

export type PrintLabOrderAttachmentRecordType = 'submitted_job' | 'successful_gcode' | 'manual'

export type PrintLabExactMaterial = {
  material: string
  grams: number
  colors: string[]
  source: 'printlab'
}

export type PrintLabOrderAttachment = {
  at: string
  source: 'printlab_admin_link'
  actor: 'makerworks_admin'
  adminId: string | null
  note: string | null
  recordType: PrintLabOrderAttachmentRecordType
  printLabJobId: string | null
  successfulGcodeId: string | null
  status: string | null
  printerId: string | null
  printerName: string | null
  queueItemId: string | null
  modelId: string | null
  modelName: string | null
  fileName: string | null
  filePath: string | null
  plateGcode: string | null
  plateIndex: string | null
  subtaskName: string | null
  useAms: boolean | null
  amsMapping: number[] | null
  progressPercent: number | null
  currentLayer: number | null
  totalLayers: number | null
  startedAt: string | null
  completedAt: string | null
  updatedAt: string | null
  error: string | null
  exactMaterials: PrintLabExactMaterial[]
}

type AttachmentContext = {
  adminId?: string | null
  note?: string | null
}

type ManualPrintLabAttachmentInput = {
  printLabJobId?: string | null
  successfulGcodeId?: string | null
  status?: string | null
  printerId?: string | null
  printerName?: string | null
  modelId?: string | null
  modelName?: string | null
  fileName?: string | null
  filePath?: string | null
  completedAt?: string | null
  note?: string | null
}

export type ModelPrintTemplateSummary = {
  printLabJobId: string | null
  successfulGcodeId: string | null
  printerName: string | null
  fileName: string | null
  filePath: string | null
  plateGcode: string | null
  plateIndex: string | null
  subtaskName: string | null
  completedAt: string | null
  useAms: boolean | null
  amsMapping: number[] | null
  exactMaterials: PrintLabExactMaterial[]
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function readString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function readNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return null
}

function readNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const numbers = value
    .map((entry) => readNumber(entry))
    .filter((entry): entry is number => entry !== null)
  return numbers.length > 0 ? numbers : null
}

function readColors(record: Record<string, any>): string[] {
  const colors = record.colors
  if (Array.isArray(colors)) {
    return colors.map((entry) => readString(entry)).filter((entry): entry is string => Boolean(entry))
  }
  const singleColor = readString(record.color) || readString(record.color_name) || readString(record.colorName)
  return singleColor ? [singleColor] : []
}

function materialEntries(data: Record<string, any>): unknown[] {
  const direct = data.material_usage ?? data.materialUsage ?? data.actual_materials ?? data.actualMaterials
  if (Array.isArray(direct)) return direct

  const nested = asRecord(data.slicer_stats ?? data.slicerStats)
  if (Array.isArray(nested.materials)) return nested.materials

  const metadataSlicerStats = asRecord(asRecord(data.metadata).slicerStats)
  if (Array.isArray(metadataSlicerStats.materials)) return metadataSlicerStats.materials

  return []
}

function extractExactMaterials(data: Record<string, any>): PrintLabExactMaterial[] {
  return materialEntries(data)
    .map((entry) => {
      const record = asRecord(entry)
      const material = readString(record.material) || readString(record.filament_type) || readString(record.filamentType)
      const grams = readNumber(record.grams ?? record.used_grams ?? record.usedGrams ?? record.weight_grams ?? record.weightGrams)
      if (!material || grams === null || grams <= 0) return null
      return {
        material,
        grams,
        colors: readColors(record),
        source: 'printlab' as const,
      }
    })
    .filter((entry): entry is PrintLabExactMaterial => entry !== null)
}

function baseAttachment(
  recordType: PrintLabOrderAttachmentRecordType,
  context: AttachmentContext,
  receivedAt: string,
) {
  return {
    at: receivedAt,
    source: 'printlab_admin_link' as const,
    actor: 'makerworks_admin' as const,
    adminId: readString(context.adminId) ?? null,
    note: readString(context.note),
    recordType,
  }
}

export function normalizePrintLabSubmittedJobAttachment(
  record: unknown,
  context: AttachmentContext = {},
  receivedAt = new Date().toISOString(),
): PrintLabOrderAttachment {
  const data = asRecord(record)
  return {
    ...baseAttachment('submitted_job', context, receivedAt),
    printLabJobId: readString(data.id) || readString(data.job_id),
    successfulGcodeId: readString(data.successful_gcode_id) || readString(data.successfulGcodeId),
    status: readString(data.status),
    printerId: readString(data.printer_id) || readString(data.printerId),
    printerName: readString(data.printer_name) || readString(data.printerName),
    queueItemId: readString(data.queue_item_id) || readString(data.queueItemId),
    modelId: readString(data.model_id) || readString(data.modelId),
    modelName: readString(data.model_name) || readString(data.modelName),
    fileName: readString(data.file_name) || readString(data.fileName),
    filePath: readString(data.file_path) || readString(data.filePath),
    plateGcode: readString(data.plate_gcode) || readString(data.plateGcode),
    plateIndex: readString(data.plate_index) || readString(data.plateIndex),
    subtaskName: readString(data.subtask_name) || readString(data.subtaskName),
    useAms: readBoolean(data.use_ams ?? data.useAms),
    amsMapping: readNumberArray(data.ams_mapping ?? data.amsMapping),
    progressPercent: readNumber(data.progress_percent ?? data.progressPercent),
    currentLayer: readNumber(data.current_layer ?? data.currentLayer),
    totalLayers: readNumber(data.total_layers ?? data.totalLayers),
    startedAt: readString(data.started_at) || readString(data.startedAt),
    completedAt: readString(data.completed_at) || readString(data.completedAt),
    updatedAt: readString(data.updated_at) || readString(data.updatedAt),
    error: readString(data.last_error) || readString(data.error),
    exactMaterials: extractExactMaterials(data),
  }
}

export function normalizeSuccessfulGcodeAttachment(
  record: unknown,
  context: AttachmentContext = {},
  receivedAt = new Date().toISOString(),
): PrintLabOrderAttachment {
  const data = asRecord(record)
  return {
    ...baseAttachment('successful_gcode', context, receivedAt),
    printLabJobId: null,
    successfulGcodeId: readString(data.id) || readString(data.record_id),
    status: 'completed',
    printerId: readString(data.printer_id) || readString(data.printerId),
    printerName: readString(data.printer_name) || readString(data.printerName),
    queueItemId: readString(data.queue_item_id) || readString(data.queueItemId),
    modelId: readString(data.model_id) || readString(data.modelId),
    modelName: readString(data.model_name) || readString(data.modelName),
    fileName: readString(data.file_name) || readString(data.fileName),
    filePath: readString(data.file_path) || readString(data.filePath),
    plateGcode: readString(data.plate_gcode) || readString(data.plateGcode),
    plateIndex: readString(data.plate_index) || readString(data.plateIndex),
    subtaskName: readString(data.subtask_name) || readString(data.subtaskName),
    useAms: readBoolean(data.use_ams ?? data.useAms),
    amsMapping: readNumberArray(data.ams_mapping ?? data.amsMapping),
    progressPercent: readNumber(data.progress_percent ?? data.progressPercent),
    currentLayer: readNumber(data.current_layer ?? data.currentLayer),
    totalLayers: readNumber(data.total_layers ?? data.totalLayers),
    startedAt: readString(data.started_at) || readString(data.startedAt),
    completedAt: readString(data.completed_at) || readString(data.completedAt),
    updatedAt: readString(data.updated_at) || readString(data.updatedAt),
    error: readString(data.last_error) || readString(data.error),
    exactMaterials: extractExactMaterials(data),
  }
}

export function buildManualPrintLabAttachment(
  input: ManualPrintLabAttachmentInput,
  context: AttachmentContext = {},
  receivedAt = new Date().toISOString(),
): PrintLabOrderAttachment {
  return {
    ...baseAttachment('manual', { ...context, note: input.note ?? context.note }, receivedAt),
    printLabJobId: readString(input.printLabJobId),
    successfulGcodeId: readString(input.successfulGcodeId),
    status: readString(input.status) || 'completed',
    printerId: readString(input.printerId),
    printerName: readString(input.printerName),
    queueItemId: null,
    modelId: readString(input.modelId),
    modelName: readString(input.modelName),
    fileName: readString(input.fileName),
    filePath: readString(input.filePath),
    plateGcode: null,
    plateIndex: null,
    subtaskName: null,
    useAms: null,
    amsMapping: null,
    progressPercent: null,
    currentLayer: null,
    totalLayers: null,
    startedAt: null,
    completedAt: readString(input.completedAt),
    updatedAt: null,
    error: null,
    exactMaterials: [],
  }
}

export function mergePrintLabOrderAttachment(
  metadata: unknown,
  attachment: PrintLabOrderAttachment,
): Record<string, unknown> {
  const prior = asRecord(metadata)
  const printLabSubmissions = Array.isArray(prior.printLabSubmissions) ? prior.printLabSubmissions : []
  const printLabRecordId = attachment.successfulGcodeId || attachment.printLabJobId
  const next: Record<string, unknown> = {
    ...prior,
    printLabSubmissions: [...printLabSubmissions, attachment],
    lastPrintLabSubmission: {
      ...attachment,
      printLabJobId: attachment.printLabJobId || attachment.successfulGcodeId,
    },
  }

  if (attachment.exactMaterials.length > 0) {
    next.slicerStats = {
      ...asRecord(prior.slicerStats),
      source: 'printlab',
      updatedAt: attachment.at,
      printLabRecordId,
      materials: attachment.exactMaterials,
    }
  }

  return next
}

export function resolveOrderStatusFromPrintLabAttachment(
  currentStatus: string,
  attachment: Pick<PrintLabOrderAttachment, 'status'>,
) {
  return deriveOrderStatusFromPrintLabStatus(attachment.status, currentStatus)
}

export function hasExactPrintLabMaterialUsage(
  attachment: Pick<PrintLabOrderAttachment, 'exactMaterials'>,
) {
  return attachment.exactMaterials.some((entry) => Number.isFinite(entry.grams) && entry.grams > 0)
}

export function buildModelPrintTemplateSummary(
  attachment: Pick<
    PrintLabOrderAttachment,
    | 'status'
    | 'printLabJobId'
    | 'successfulGcodeId'
    | 'printerName'
    | 'fileName'
    | 'filePath'
    | 'plateGcode'
    | 'plateIndex'
    | 'subtaskName'
    | 'completedAt'
    | 'useAms'
    | 'amsMapping'
    | 'exactMaterials'
  >,
): ModelPrintTemplateSummary | null {
  if (String(attachment.status || '').trim().toLowerCase() !== 'completed') return null
  if (!attachment.successfulGcodeId) return null

  return {
    printLabJobId: attachment.printLabJobId,
    successfulGcodeId: attachment.successfulGcodeId,
    printerName: attachment.printerName,
    fileName: attachment.fileName,
    filePath: attachment.filePath,
    plateGcode: attachment.plateGcode,
    plateIndex: attachment.plateIndex,
    subtaskName: attachment.subtaskName,
    completedAt: attachment.completedAt,
    useAms: attachment.useAms,
    amsMapping: attachment.amsMapping,
    exactMaterials: attachment.exactMaterials,
  }
}

export function findSuccessfulGcodeRecord<T>(records: T[], recordId: string): T | null {
  const needle = readString(recordId)
  if (!needle) return null
  return records.find((entry) => {
    const record = asRecord(entry)
    return readString(record.id) === needle || readString(record.record_id) === needle
  }) ?? null
}
