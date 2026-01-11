export type MaterialType = string
export const DIMENSION_AXES = ['x', 'y', 'z'] as const
export type DimensionAxis = typeof DIMENSION_AXES[number]
export type ScaleOverrides = Partial<Record<DimensionAxis, number | null>>
export type TargetDimensions = { x?: number | null; y?: number | null; z?: number | null }
export type ModelDimensions = { x?: number | null; y?: number | null; z?: number | null }

export const MATERIAL_OPTIONS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PA6', 'PA12', 'NYLON', 'PC', 'RESIN'] as const
export const FINISH_OPTIONS = ['standard', 'matte', 'gloss', 'polished', 'textured'] as const

const DEFAULT_PLA_PRICE = 25
const DEFAULT_PETG_PRICE = 28
const DEFAULT_MAX_COLORS = 4
const SCALE_MIN = 0.1
const SCALE_MAX = 5

let clientMaxColorOverride: number | null = null
let clientMaterialPrices: Partial<Record<string, number>> | null = null
let clientColorSurchargeRate: number | null = null
let clientFinishSurcharges: Record<string, number> | null = null

const MATERIAL_PRICE_DEFAULTS: Record<string, number> = {
  PLA: DEFAULT_PLA_PRICE,
  PETG: DEFAULT_PETG_PRICE,
  ABS: DEFAULT_PLA_PRICE,
  ASA: DEFAULT_PLA_PRICE,
  TPU: DEFAULT_PLA_PRICE,
  PA6: DEFAULT_PLA_PRICE,
  PA12: DEFAULT_PLA_PRICE,
  NYLON: DEFAULT_PLA_PRICE,
  PC: DEFAULT_PLA_PRICE,
  RESIN: DEFAULT_PLA_PRICE,
}

const DEFAULT_FINISH_SURCHARGES: Record<string, number> = {
  standard: 0,
  matte: 0.05,
  gloss: 0.1,
  polished: 0.15,
  textured: 0.08,
}

function parseFinishSurcharges(raw?: string | null): Record<string, number> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const result: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const numeric = Number(value)
      if (!Number.isFinite(numeric)) continue
      result[key.toLowerCase()] = numeric
    }
    return Object.keys(result).length ? result : null
  } catch {
    return null
  }
}

function readNumber(keys: string[], fallback: number): number {
  for (const key of keys) {
    const raw = process.env[key]
    if (raw != null && raw !== '') {
      const parsed = Number(raw)
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed
    }
  }
  return fallback
}

export function getMaterialMultiplier(material: MaterialType | undefined | null): number {
  const normalized = normalizeMaterialName(material)
  if (!normalized || normalized === 'PLA') return 1
  const pla = resolveMaterialPricePerKg('PLA')
  const target = resolveMaterialPricePerKg(normalized)
  if (!pla || !target) return 1
  return target / pla
}

function resolveMaterialPricePerKg(material: MaterialType | undefined | null): number {
  const normalized = normalizeMaterialName(material)
  const clientOverride = clientMaterialPrices?.[normalized]
  if (clientOverride != null && Number.isFinite(Number(clientOverride)) && Number(clientOverride) >= 0) {
    return Number(clientOverride)
  }
  const fallback = MATERIAL_PRICE_DEFAULTS[normalized] ?? DEFAULT_PLA_PRICE
  return readNumber(
    [
      `NEXT_PUBLIC_${normalized}_PRICE_PER_KG`,
      `${normalized}_PRICE_PER_KG_USD`,
      `${normalized}_PRICE_PER_KG_CAD`,
    ],
    fallback,
  )
}

function clampMaxColors(value: number): number {
  return Math.max(1, Math.min(16, Math.round(value)))
}

function readMaxCartColors(): number {
  const configured = readNumber(
    ['NEXT_PUBLIC_MAX_CART_COLORS', 'MAX_CART_COLORS'],
    DEFAULT_MAX_COLORS,
  )
  if (!Number.isFinite(configured)) return DEFAULT_MAX_COLORS
  return clampMaxColors(configured)
}

export function getMaxCartColors(): number {
  if (typeof window !== 'undefined' && clientMaxColorOverride != null) {
    return clientMaxColorOverride
  }
  return readMaxCartColors()
}

export function setClientMaxCartColors(value?: number | null) {
  if (typeof window === 'undefined') return
  if (value == null || Number.isNaN(Number(value))) {
    clientMaxColorOverride = null
    return
  }
  clientMaxColorOverride = clampMaxColors(Number(value))
}

export function setClientMaterialPrices(prices?: Record<string, number | null | undefined> | null) {
  if (typeof window === 'undefined') return
  if (!prices || typeof prices !== 'object') {
    clientMaterialPrices = null
    return
  }
  const next: Record<string, number> = {}
  for (const [key, value] of Object.entries(prices)) {
    const normalized = normalizeMaterialName(key)
    if (!normalized) continue
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric >= 0) {
      next[normalized] = numeric
    }
  }
  clientMaterialPrices = Object.keys(next).length ? next : null
}

export function setClientColorSurchargeRate(value?: number | null) {
  if (typeof window === 'undefined') return
  const numeric = value == null ? null : Number(value)
  if (numeric == null || Number.isNaN(numeric)) {
    clientColorSurchargeRate = null
    return
  }
  clientColorSurchargeRate = Math.max(0, Math.min(1, numeric))
}

export function setClientFinishSurcharges(prices?: Record<string, number | null | undefined> | null) {
  if (typeof window === 'undefined') return
  if (!prices || typeof prices !== 'object') {
    clientFinishSurcharges = null
    return
  }
  const next: Record<string, number> = {}
  for (const [key, value] of Object.entries(prices)) {
    const normalized = String(key).trim().toLowerCase()
    if (!normalized) continue
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric >= 0) {
      next[normalized] = numeric
    }
  }
  clientFinishSurcharges = Object.keys(next).length ? next : null
}

export function normalizeColors(colors?: (string | null | undefined)[], maxColors = getMaxCartColors()): string[] {
  if (!Array.isArray(colors) || colors.length === 0) return []
  const limit = clampMaxColors(maxColors)
  const result: string[] = []
  for (const color of colors) {
    if (result.length >= limit) break
    const cleaned = (color || '').trim()
    if (cleaned) result.push(cleaned)
  }
  return result
}

export function normalizeMaterialName(material?: string | null): MaterialType {
  const trimmed = (material || '').trim()
  return trimmed ? trimmed.toUpperCase() : 'PLA'
}

export function getColorMultiplier(colors?: (string | null | undefined)[]): number {
  const count = normalizeColors(colors).length
  if (count <= 1) return 1
  const rate = clientColorSurchargeRate != null
    ? clientColorSurchargeRate
    : readNumber(
      ['NEXT_PUBLIC_COLOR_SURCHARGE_RATE', 'COLOR_SURCHARGE_RATE'],
      0.05,
    )
  return 1 + Math.max(0, count - 1) * rate
}

export function getFinishMultiplier(finish?: string | null): number {
  if (!finish) return 1
  const normalized = String(finish).trim().toLowerCase()
  if (!normalized) return 1
  const envMap = clientFinishSurcharges || parseFinishSurcharges(
    process.env.NEXT_PUBLIC_FINISH_SURCHARGES
      || process.env.NEXT_PUBLIC_FINISH_SURCHARGE_MAP
      || process.env.FINISH_SURCHARGES
      || process.env.FINISH_SURCHARGE_MAP
      || null,
  )
  const surcharge = envMap?.[normalized] ?? DEFAULT_FINISH_SURCHARGES[normalized] ?? 0
  return Math.max(1, 1 + surcharge)
}

export function resolveAxisScale(scale?: number | null, overrides?: ScaleOverrides | null, axis: DimensionAxis = 'x'): number {
  const base = clampScale(scale)
  const override = overrides?.[axis]
  if (override == null || Number.isNaN(Number(override))) return base
  return clampScale(Number(override))
}

export function getVolumeScaleMultiplier(scale?: number | null, overrides?: ScaleOverrides | null): number {
  return DIMENSION_AXES
    .map(axis => resolveAxisScale(scale, overrides, axis))
    .reduce((product, value) => product * value, 1)
}

export function getScaledUnitPrice(
  basePrice: number,
  scale: number,
  material: MaterialType | undefined | null,
  colors?: (string | null | undefined)[],
  finish?: string | null,
  overrides?: ScaleOverrides | null,
): number {
  const materialMultiplier = getMaterialMultiplier(material)
  const colorMultiplier = getColorMultiplier(colors)
  const finishMultiplier = getFinishMultiplier(finish)
  const volumeMultiplier = getVolumeScaleMultiplier(scale, overrides)
  return basePrice * volumeMultiplier * materialMultiplier * colorMultiplier * finishMultiplier
}

export function clampScale(scale?: number | null) {
  if (scale == null || Number.isNaN(Number(scale))) return 1
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Number(scale)))
}

export function resolveScaleFromDimensions(params: {
  size?: ModelDimensions | null
  target?: TargetDimensions | null
  scale?: number | null
  scaleX?: number | null
  scaleY?: number | null
  scaleZ?: number | null
  lockDimensions?: boolean | null
}) {
  const baseScale = clampScale(params.scale ?? 1)
  let scaleX = params.scaleX != null ? clampScale(params.scaleX) : baseScale
  let scaleY = params.scaleY != null ? clampScale(params.scaleY) : baseScale
  let scaleZ = params.scaleZ != null ? clampScale(params.scaleZ) : baseScale

  const size = params.size
  const target = params.target
  const getAxisScale = (axis: DimensionAxis) => {
    const targetVal = target?.[axis]
    const sizeVal = size?.[axis]
    if (targetVal == null || sizeVal == null) return null
    const numericTarget = Number(targetVal)
    const numericSize = Number(sizeVal)
    if (!Number.isFinite(numericTarget) || !Number.isFinite(numericSize) || numericTarget <= 0 || numericSize <= 0) return null
    return clampScale(numericTarget / numericSize)
  }

  if (target && size) {
    if (params.lockDimensions) {
      const uniform = getAxisScale('x') ?? getAxisScale('y') ?? getAxisScale('z')
      if (uniform != null) {
        scaleX = uniform
        scaleY = uniform
        scaleZ = uniform
      }
    } else {
      const xScale = getAxisScale('x')
      const yScale = getAxisScale('y')
      const zScale = getAxisScale('z')
      if (xScale != null) scaleX = xScale
      if (yScale != null) scaleY = yScale
      if (zScale != null) scaleZ = zScale
    }
  }

  const uniformScale = clampScale(Math.cbrt(scaleX * scaleY * scaleZ))
  return { scaleX, scaleY, scaleZ, uniformScale }
}

export const MAX_CART_COLORS = getMaxCartColors()
