export type MaterialType = 'PLA' | 'PETG'

const DEFAULT_PLA_PRICE = 25
const DEFAULT_PETG_PRICE = 28
const MAX_COLORS = 4

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

export function getScaledUnitPrice(basePrice: number, scale: number, material: MaterialType | undefined | null, colors?: (string | null | undefined)[]): number {
  const clampedScale = Math.max(0.1, Math.min(5, scale || 1))
  const materialMultiplier = getMaterialMultiplier(material)
  const colorMultiplier = getColorMultiplier(colors)
  return basePrice * Math.pow(clampedScale, 3) * materialMultiplier * colorMultiplier
}

export function clampScale(scale?: number | null) {
  return Math.max(0.1, Math.min(5, scale || 1))
}

export const MAX_CART_COLORS = MAX_COLORS
