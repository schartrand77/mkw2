import type { Prisma } from '@prisma/client'
import type { ModelPrintTemplateSummary, PrintLabExactMaterial } from './printlab-order-link'

type JsonRecord = Record<string, any>

export type NormalizedModelGcodeCapture = {
  printLabRecordId: string
  printLabJobId: string | null
  printerId: string | null
  printerName: string | null
  modelName: string | null
  modelKey: string | null
  fileName: string | null
  filePath: string | null
  plateGcode: string | null
  plateIndex: string | null
  subtaskName: string | null
  useAms: boolean | null
  amsMapping: number[] | null
  materialUsage: PrintLabExactMaterial[]
  completedAt: Date | null
  capturedAt: Date
  payload: JsonRecord
}

type StoredModelGcode = {
  printLabRecordId: string
  printLabJobId?: string | null
  printerName?: string | null
  fileName?: string | null
  filePath?: string | null
  plateGcode?: string | null
  plateIndex?: string | null
  subtaskName?: string | null
  useAms?: boolean | null
  amsMapping?: unknown
  materialUsage?: unknown
  completedAt?: Date | string | null
  capturedAt?: Date | string | null
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
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
  const entries = value.map((entry) => readNumber(entry)).filter((entry): entry is number => entry !== null)
  return entries.length > 0 ? entries : null
}

function readDate(value: unknown): Date | null {
  const raw = readString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function readColors(record: JsonRecord): string[] {
  if (Array.isArray(record.colors)) {
    return record.colors.map((entry) => readString(entry)).filter((entry): entry is string => Boolean(entry))
  }
  const color = readString(record.color) || readString(record.color_name) || readString(record.colorName)
  return color ? [color] : []
}

function materialEntries(data: JsonRecord): unknown[] {
  const direct = data.material_usage ?? data.materialUsage ?? data.actual_materials ?? data.actualMaterials
  if (Array.isArray(direct)) return direct
  const nested = asRecord(data.slicer_stats ?? data.slicerStats)
  if (Array.isArray(nested.materials)) return nested.materials
  return []
}

export function normalizeModelGcodeCapture(input: unknown, receivedAt = new Date()): NormalizedModelGcodeCapture {
  const data = asRecord(input)
  const printLabRecordId = readString(data.record_id) || readString(data.id) || readString(data.successful_gcode_id)
  if (!printLabRecordId) throw Object.assign(new Error('PrintLab successful G-code record ID is required.'), { status: 400 })

  const materialUsage = materialEntries(data)
    .map((entry) => {
      const record = asRecord(entry)
      const material = readString(record.material) || readString(record.filament_type) || readString(record.filamentType)
      const grams = readNumber(record.grams ?? record.used_grams ?? record.usedGrams ?? record.weight_grams ?? record.weightGrams)
      if (!material || grams === null || grams <= 0) return null
      return { material, grams, colors: readColors(record), source: 'printlab' as const }
    })
    .filter((entry): entry is PrintLabExactMaterial => entry !== null)

  return {
    printLabRecordId,
    printLabJobId: readString(data.job_id) || readString(data.printLabJobId),
    printerId: readString(data.printer_id) || readString(data.printerId),
    printerName: readString(data.printer_name) || readString(data.printerName),
    modelName: readString(data.model_name) || readString(data.modelName),
    modelKey: readString(data.model_key) || readString(data.modelKey),
    fileName: readString(data.file_name) || readString(data.fileName),
    filePath: readString(data.file_path) || readString(data.filePath),
    plateGcode: readString(data.plate_gcode) || readString(data.plateGcode),
    plateIndex: readString(data.plate_index) || readString(data.plateIndex),
    subtaskName: readString(data.subtask_name) || readString(data.subtaskName),
    useAms: readBoolean(data.use_ams ?? data.useAms),
    amsMapping: readNumberArray(data.ams_mapping ?? data.amsMapping),
    materialUsage,
    completedAt: readDate(data.completed_at ?? data.completedAt),
    capturedAt: readDate(data.captured_at ?? data.capturedAt) || receivedAt,
    payload: data,
  }
}

export function modelGcodeCreateData(modelId: string, capture: NormalizedModelGcodeCapture): Prisma.ModelGcodeUncheckedCreateInput {
  return {
    modelId,
    printLabRecordId: capture.printLabRecordId,
    printLabJobId: capture.printLabJobId,
    printerId: capture.printerId,
    printerName: capture.printerName,
    modelName: capture.modelName,
    modelKey: capture.modelKey,
    fileName: capture.fileName,
    filePath: capture.filePath,
    plateGcode: capture.plateGcode,
    plateIndex: capture.plateIndex,
    subtaskName: capture.subtaskName,
    useAms: capture.useAms,
    amsMapping: capture.amsMapping as Prisma.InputJsonValue,
    materialUsage: capture.materialUsage as Prisma.InputJsonValue,
    completedAt: capture.completedAt,
    capturedAt: capture.capturedAt,
    payload: capture.payload as Prisma.InputJsonValue,
  }
}

export function modelGcodeUpdateData(capture: NormalizedModelGcodeCapture): Prisma.ModelGcodeUncheckedUpdateInput {
  return {
    printLabJobId: capture.printLabJobId,
    printerId: capture.printerId,
    printerName: capture.printerName,
    modelName: capture.modelName,
    modelKey: capture.modelKey,
    fileName: capture.fileName,
    filePath: capture.filePath,
    plateGcode: capture.plateGcode,
    plateIndex: capture.plateIndex,
    subtaskName: capture.subtaskName,
    useAms: capture.useAms,
    amsMapping: capture.amsMapping as Prisma.InputJsonValue,
    materialUsage: capture.materialUsage as Prisma.InputJsonValue,
    completedAt: capture.completedAt,
    capturedAt: capture.capturedAt,
    payload: capture.payload as Prisma.InputJsonValue,
  }
}

export function buildModelGcodeTemplateSummary(record: StoredModelGcode): ModelPrintTemplateSummary | null {
  const successfulGcodeId = readString(record.printLabRecordId)
  if (!successfulGcodeId) return null
  const materials = Array.isArray(record.materialUsage) ? record.materialUsage as PrintLabExactMaterial[] : []
  const amsMapping = readNumberArray(record.amsMapping)
  const completed = record.completedAt || record.capturedAt || null
  return {
    printLabJobId: readString(record.printLabJobId),
    successfulGcodeId,
    printerName: readString(record.printerName),
    fileName: readString(record.fileName),
    filePath: readString(record.filePath),
    plateGcode: readString(record.plateGcode),
    plateIndex: readString(record.plateIndex),
    subtaskName: readString(record.subtaskName),
    completedAt: completed instanceof Date ? completed.toISOString() : readString(completed),
    useAms: readBoolean(record.useAms),
    amsMapping,
    exactMaterials: materials,
  }
}
