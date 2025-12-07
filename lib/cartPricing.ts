export type MaterialType = 'PLA' | 'PETG'
export const DIMENSION_AXES = ['x', 'y', 'z'] as const
export type DimensionAxis = typeof DIMENSION_AXES[number]
export type ScaleOverrides = Partial<Record<DimensionAxis, number | null>>

const DEFAULT_PLA_PRICE = 25
const DEFAULT_PETG_PRICE = 28
const DEFAULT_MAX_COLORS = 4
const SCALE_MIN = 0.1
const SCALE_MAX = 5
const MAX_COLORS = (() => {
  const configured = readNumber(
    ['NEXT_PUBLIC_MAX_CART_COLORS', 'MAX_CART_COLORS'],
    DEFAULT_MAX_COLORS,
  )
  if (!Number.isFinite(configured)) return DEFAULT_MAX_COLORS
  return Math.max(1, Math.min(16, Math.round(configured)))
})()

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
  if (!material || material === 'PLA') return 1
  const pla = readNumber(
    ['NEXT_PUBLIC_PLA_PRICE_PER_KG', 'PLA_PRICE_PER_KG_USD', 'PLA_PRICE_PER_KG_CAD'],
    DEFAULT_PLA_PRICE,
  )
  const petg = readNumber(
    ['NEXT_PUBLIC_PETG_PRICE_PER_KG', 'PETG_PRICE_PER_KG_USD', 'PETG_PRICE_PER_KG_CAD'],
    DEFAULT_PETG_PRICE,
  )
  if (!pla || !petg) return 1
  return petg / pla
}

export function normalizeColors(colors?: (string | null | undefined)[]): string[] {
  if (!Array.isArray(colors) || colors.length === 0) return []
  const result: string[] = []
  for (const color of colors) {
    if (result.length >= MAX_COLORS) break
    const cleaned = (color || '').trim()
    if (cleaned) result.push(cleaned)
  }
  return result
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

export const MAX_CART_COLORS = MAX_COLORS
