export type MaterialType = string
export const DIMENSION_AXES = ['x', 'y', 'z'] as const
export type DimensionAxis = typeof DIMENSION_AXES[number]
export type ScaleOverrides = Partial<Record<DimensionAxis, number | null>>

export const MATERIAL_OPTIONS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PA6', 'PA12', 'NYLON', 'PC', 'RESIN'] as const

const DEFAULT_PLA_PRICE = 25
const DEFAULT_PETG_PRICE = 28
const DEFAULT_MAX_COLORS = 4
const SCALE_MIN = 0.1
const SCALE_MAX = 5

let clientMaxColorOverride: number | null = null

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
  const pla = readNumber(
    ['NEXT_PUBLIC_PLA_PRICE_PER_KG', 'PLA_PRICE_PER_KG_USD', 'PLA_PRICE_PER_KG_CAD'],
    DEFAULT_PLA_PRICE,
  )
  const petg = readNumber(
    ['NEXT_PUBLIC_PETG_PRICE_PER_KG', 'PETG_PRICE_PER_KG_USD', 'PETG_PRICE_PER_KG_CAD'],
    DEFAULT_PETG_PRICE,
  )
  if (!pla || !petg) return 1
  return normalized === 'PETG' ? petg / pla : 1
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
  const rate = readNumber(
    ['NEXT_PUBLIC_COLOR_SURCHARGE_RATE', 'COLOR_SURCHARGE_RATE'],
    0.05,
  )
  return 1 + Math.max(0, count - 1) * rate
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
  overrides?: ScaleOverrides | null,
): number {
  const materialMultiplier = getMaterialMultiplier(material)
  const colorMultiplier = getColorMultiplier(colors)
  const volumeMultiplier = getVolumeScaleMultiplier(scale, overrides)
  return basePrice * volumeMultiplier * materialMultiplier * colorMultiplier
}

export function clampScale(scale?: number | null) {
  if (scale == null || Number.isNaN(Number(scale))) return 1
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Number(scale)))
}

export const MAX_CART_COLORS = getMaxCartColors()
