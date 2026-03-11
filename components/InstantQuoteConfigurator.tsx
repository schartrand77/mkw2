"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import {
  clampScale,
  DIMENSION_AXES,
  FINISH_OPTIONS,
  MATERIAL_OPTIONS,
  normalizeColors,
  normalizeMaterialName,
  resolveAxisScale,
  type MaterialType,
  type ScaleOverrides,
} from '@/lib/cartPricing'
import { formatCurrency } from '@/lib/currency'
import { buildAllowedColorTokenSet, isColorAllowed, normalizeModelColorSlotCount, sanitizeAllowedColors } from '@/lib/color-constraints'
import type { PricingDetails } from '@/lib/pricing'
import { normalizeHexColor, resolveColorPaint } from '@/lib/color-swatch'
import QuoteBreakdownCard from '@/components/QuoteBreakdownCard'
import StatusChip from '@/components/StatusChip'
import FeasibilityScorecard from '@/components/FeasibilityScorecard'
import MaterialRecommenderCard from '@/components/MaterialRecommenderCard'
import { buildFeasibilityScorecard } from '@/lib/feasibility-scorecard'
import { recommendMaterials } from '@/lib/material-recommender'

type QuoteResponse = {
  quote: {
    priceUsd: number
    leadTimeHours: number
    leadTimeWindowHours?: { min: number; max: number }
    etaConfidenceScore?: number
    scale: number
    scaleX: number
    scaleY: number
    scaleZ: number
    targetDimensions?: { x?: number; y?: number; z?: number } | null
    pricing?: PricingDetails | null
    adjustments?: {
      batchDiscountPercent?: number
      rush?: boolean
      demandSurgeMultiplier?: number
      rushMultiplier?: number
      toleranceMultiplier?: number
    }
    leadTimeSignals?: {
      baseHours: number
      queueHours: number
      queueDelayHours: number
      capacityHoursPerDay: number
      printerAvailabilityPercent: number
      materialAvailability: 'in_stock' | 'limited' | 'out_of_stock' | 'unknown'
    }
  }
}

type GcodeEstimate = {
  estimate: {
    material: string
    cm3: number
    estimatedSeconds: number | null
    filamentMm: number | null
    filamentGrams: number | null
    materialBreakdown: Array<{ material: string; filamentMm: number }> | null
    priceUsd: number
    adjustments?: {
      batchDiscountPercent?: number
      rush?: boolean
      demandSurgeMultiplier?: number
      rushMultiplier?: number
    }
  }
}

type Props = {
  modelId: string
  title: string
  priceUsd?: number | null
  material?: string | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  thumbnail?: string | null
  defaultColors?: string[] | null
  colorSlotCount?: number | null
  allowedColors?: string[] | null
  flatRatePricing?: boolean | null
  parts?: Array<{
    id: string
    name?: string | null
    index?: number | null
    priceUsd?: number | null
    sizeXmm?: number | null
    sizeYmm?: number | null
    sizeZmm?: number | null
  }>
}

type ToleranceClass = 'draft' | 'standard' | 'cosmetic' | 'fit_critical'

const TOLERANCE_OPTIONS: Array<{ value: ToleranceClass; label: string; description: string; multiplier: number }> = [
  { value: 'draft', label: 'Draft', description: 'Fastest, lowest-cost setup for validation parts.', multiplier: 0.94 },
  { value: 'standard', label: 'Standard', description: 'Balanced production setup for most parts.', multiplier: 1 },
  { value: 'cosmetic', label: 'Cosmetic', description: 'Bias toward cleaner visible surfaces and finish quality.', multiplier: 1.08 },
  { value: 'fit_critical', label: 'Fit-critical', description: 'Tighter process setup for mating or tolerance-sensitive parts.', multiplier: 1.16 },
]

const SCALE_MIN = 0.1
const SCALE_MAX = 5
type DimensionAxis = (typeof DIMENSION_AXES)[number]
const COLOR_PICKER_FALLBACK = '#1f2937'
const HEX_WITH_HASH_RE = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})/i
const HEX_WITH_0X_RE = /0x([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})/i
const HEX_BARE_RE = /\b([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/i
const isHexColor = (value?: string | null) => !!value && /^#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})$/i.test(value.trim())
const normalizeAlphaHex = (value: string) => {
  const trimmed = value.trim()
  if (!/^#([0-9a-f]{8})$/i.test(trimmed)) return trimmed
  const hex = trimmed.slice(1)
  const alpha = hex.slice(0, 2).toLowerCase()
  const tail = hex.slice(6, 8).toLowerCase()
  if ((alpha === '00' || alpha === 'ff') && tail !== '00' && tail !== 'ff') {
    return `#${hex.slice(2)}${alpha}`
  }
  return trimmed
}
const COLOR_PALETTE = [
  { name: 'Ivory', hex: '#f8fafc' },
  { name: 'Mist', hex: '#e2e8f0' },
  { name: 'Dove', hex: '#94a3b8' },
  { name: 'Slate', hex: '#64748b' },
  { name: 'Onyx', hex: '#0f172a' },
  { name: 'Rose', hex: '#fb7185' },
  { name: 'Cherry', hex: '#ef4444' },
  { name: 'Tangerine', hex: '#f97316' },
  { name: 'Honey', hex: '#f59e0b' },
  { name: 'Lemon', hex: '#facc15' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Emerald', hex: '#22c55e' },
  { name: 'Mint', hex: '#2dd4bf' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Sky', hex: '#38bdf8' },
  { name: 'Ocean', hex: '#0ea5e9' },
  { name: 'Denim', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Plum', hex: '#a855f7' },
  { name: 'Lilac', hex: '#c084fc' },
  { name: 'Orchid', hex: '#e879f9' },
  { name: 'Peach', hex: '#fdba74' },
  { name: 'Cocoa', hex: '#a16207' },
  { name: 'Sand', hex: '#d6a981' },
  { name: 'Forest', hex: '#15803d' },
  { name: 'Navy', hex: '#1e3a8a' },
  { name: 'Stone', hex: '#78716c' },
]
type StockworksPalette = {
  enabled: boolean
  materials: Record<string, { inStock: StockworksColor[] | string[]; orderable: StockworksColor[] | string[] }>
  materialTypes?: string[]
}
type StockworksColor = {
  name: string
  hex?: string | null
  brand?: string | null
  category?: string | null
}
type SwatchOption = {
  name: string
  hex: string
  paint: string
  inStock?: boolean
  brand?: string
  category?: string
}
const normalizeColorValue = (value?: string | null) => (value || '').trim().toLowerCase()
const extractHex = (value?: string | null) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  const hashMatch = trimmed.match(HEX_WITH_HASH_RE)
  if (hashMatch) return normalizeAlphaHex(`#${hashMatch[1]}`)
  const hexMatch = trimmed.match(HEX_WITH_0X_RE)
  if (hexMatch) return normalizeAlphaHex(`#${hexMatch[1]}`)
  const bareMatch = trimmed.match(HEX_BARE_RE)
  return bareMatch ? normalizeAlphaHex(`#${bareMatch[1]}`) : ''
}
const parseColorString = (value?: string | null) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return { name: '', hex: '' }
  const hex = extractHex(trimmed)
  const name = trimmed.replace(HEX_WITH_HASH_RE, '').replace(HEX_WITH_0X_RE, '').replace(HEX_BARE_RE, '').trim()
  return { name, hex }
}
const normalizeColorKey = (value: string | StockworksColor) => {
  if (typeof value === 'string') {
    const parsed = parseColorString(value)
    return normalizeColorValue(parsed.name || parsed.hex || value)
  }
  const base = normalizeColorValue(value.name || value.hex || '')
  const brand = normalizeColorValue(value.brand || '')
  const category = normalizeColorValue(value.category || '')
  const scope = [brand, category].filter(Boolean).join('::')
  return scope ? `${scope}::${base}` : base
}
const toColorMeta = (value: string | StockworksColor) => {
  if (typeof value === 'string') {
    const parsed = parseColorString(value)
    return { name: parsed.name || value, hex: parsed.hex, brand: '', category: '' }
  }
  const hex = value.hex ? normalizeAlphaHex(value.hex) : extractHex(value.name)
  const name = value.name ? value.name.replace(HEX_WITH_HASH_RE, '').replace(HEX_WITH_0X_RE, '').replace(HEX_BARE_RE, '').trim() : ''
  return { name: name || value.name || hex || 'Unknown', hex, brand: value.brand || '', category: value.category || '' }
}
const resolveSwatch = (value?: string | null) => {
  const parsed = parseColorString(value)
  const normalized = normalizeColorValue(parsed.name || parsed.hex || value)
  if (!normalized) return null
  const paletteMatch = COLOR_PALETTE.find((swatch) => swatch.hex.toLowerCase() === normalized || swatch.name.toLowerCase() === normalized) || null
  if (paletteMatch) return paletteMatch
  if (parsed.hex) return { name: parsed.name || parsed.hex, hex: parsed.hex }
  return parsed.name ? { name: parsed.name, hex: '' } : null
}

const hexToRgb = (hex: string) => {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return null
  const raw = normalized.slice(1)
  const r = Number.parseInt(raw.slice(0, 2), 16)
  const g = Number.parseInt(raw.slice(2, 4), 16)
  const b = Number.parseInt(raw.slice(4, 6), 16)
  if ([r, g, b].some((c) => Number.isNaN(c))) return null
  return { r, g, b }
}

const mixHex = (a: string, b: string, ratio = 0.5) => {
  const rgbA = hexToRgb(a)
  const rgbB = hexToRgb(b)
  if (!rgbA || !rgbB) return ''
  const blend = (x: number, y: number) => Math.round(x + (y - x) * ratio)
  const r = blend(rgbA.r, rgbB.r)
  const g = blend(rgbA.g, rgbB.g)
  const bVal = blend(rgbA.b, rgbB.b)
  return `#${[r, g, bVal].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

const buildBlendGradient = (hexes: string[]) => {
  if (hexes.length === 0) return ''
  if (hexes.length === 1) return hexes[0]
  const stops = hexes.map((hex, idx) => {
    const pct = Math.round((idx / (hexes.length - 1)) * 100)
    return `${hex} ${pct}%`
  })
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

export default function InstantQuoteConfigurator({
  modelId,
  title,
  priceUsd,
  material,
  sizeXmm,
  sizeYmm,
  sizeZmm,
  thumbnail,
  defaultColors,
  colorSlotCount,
  allowedColors,
  flatRatePricing,
  parts,
}: Props) {
  const { add, maxColors } = useCart()
  const [materialChoice, setMaterialChoice] = useState<MaterialType>(normalizeMaterialName(material))
  const [colors, setColors] = useState<string[]>(() => (Array.isArray(defaultColors) ? defaultColors : []))
  const [finish, setFinish] = useState<string>('standard')
  const [infillPct, setInfillPct] = useState<number>(20)
  const [toleranceClass, setToleranceClass] = useState<ToleranceClass>('standard')
  const [scale, setScale] = useState<number>(1)
  const [rush, setRush] = useState(false)
  const [lockDimensions, setLockDimensions] = useState(true)
  const [dimensionOverrides, setDimensionOverrides] = useState<ScaleOverrides | null>(null)
  const [dimensionInputs, setDimensionInputs] = useState<Record<DimensionAxis, string>>({ x: '', y: '', z: '' })
  const [activeDimensionAxis, setActiveDimensionAxis] = useState<DimensionAxis | null>(null)
  const [quote, setQuote] = useState<QuoteResponse['quote'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gcodeEstimate, setGcodeEstimate] = useState<GcodeEstimate['estimate'] | null>(null)
  const [gcodeError, setGcodeError] = useState<string | null>(null)
  const [gcodeLoading, setGcodeLoading] = useState(false)
  const [activeColorSlot, setActiveColorSlot] = useState<number | null>(null)
  const [stockworksPalette, setStockworksPalette] = useState<StockworksPalette | null>(null)
  const [materialGoals, setMaterialGoals] = useState({
    needImpactResistance: false,
    needHeatResistance: false,
    needUvResistance: false,
    needFlexibility: false,
    budgetSensitive: true,
  })
  const paletteRef = useRef<HTMLDivElement | null>(null)
  const configuredSlotCount = useMemo(() => normalizeModelColorSlotCount(colorSlotCount), [colorSlotCount])
  const slotLimit = useMemo(() => configuredSlotCount ?? maxColors, [configuredSlotCount, maxColors])
  const allowedColorList = useMemo(() => sanitizeAllowedColors(allowedColors), [allowedColors])
  const allowedColorTokens = useMemo(() => buildAllowedColorTokenSet(allowedColorList), [allowedColorList])
  const normalizedColors = useMemo(
    () => normalizeColors(colors, slotLimit).filter((value) => isColorAllowed(value, allowedColorTokens)),
    [colors, slotLimit, allowedColorTokens],
  )
  const hasRequiredColor = normalizedColors.length > 0

  useEffect(() => {
    if (!Array.isArray(defaultColors) || defaultColors.length === 0) return
    setColors((prev) => (prev.length > 0 ? prev : defaultColors))
  }, [defaultColors])

  useEffect(() => {
    setColors((prev) => {
      const next = normalizeColors(prev, slotLimit).filter((value) => isColorAllowed(value, allowedColorTokens))
      if (next.length === prev.length && next.every((value, idx) => value === prev[idx])) return prev
      return next
    })
  }, [slotLimit, allowedColorTokens])

  const hasDimensions = useMemo(
    () => [sizeXmm, sizeYmm, sizeZmm].some((value) => typeof value === 'number' && Number.isFinite(value) && value > 0),
    [sizeXmm, sizeYmm, sizeZmm],
  )

  const axisScale = useMemo(() => ({
    x: resolveAxisScale(scale, lockDimensions ? null : dimensionOverrides, 'x'),
    y: resolveAxisScale(scale, lockDimensions ? null : dimensionOverrides, 'y'),
    z: resolveAxisScale(scale, lockDimensions ? null : dimensionOverrides, 'z'),
  }), [scale, lockDimensions, dimensionOverrides])

  const targetDimensions = useMemo(() => {
    if (!hasDimensions) return null
    const dims: { x?: number; y?: number; z?: number } = {}
    if (typeof sizeXmm === 'number' && Number.isFinite(sizeXmm)) dims.x = Number((sizeXmm * axisScale.x).toFixed(1))
    if (typeof sizeYmm === 'number' && Number.isFinite(sizeYmm)) dims.y = Number((sizeYmm * axisScale.y).toFixed(1))
    if (typeof sizeZmm === 'number' && Number.isFinite(sizeZmm)) dims.z = Number((sizeZmm * axisScale.z).toFixed(1))
    return Object.keys(dims).length ? dims : null
  }, [axisScale, hasDimensions, sizeXmm, sizeYmm, sizeZmm])
  const quoteRequestPayload = useMemo(() => ({
    material: materialChoice,
    colors: normalizedColors,
    finish,
    infillPct,
    toleranceClass,
    priceMultiplier: TOLERANCE_OPTIONS.find((option) => option.value === toleranceClass)?.multiplier ?? 1,
    rush,
    scale,
    scaleX: axisScale.x,
    scaleY: axisScale.y,
    scaleZ: axisScale.z,
    targetDimensions: targetDimensions || undefined,
  }), [materialChoice, normalizedColors, finish, infillPct, toleranceClass, rush, scale, axisScale, targetDimensions])
  const quoteVarianceLabel = useMemo(() => {
    if (!quote?.leadTimeWindowHours) return null
    return `${quote.leadTimeWindowHours.min.toFixed(1)}-${quote.leadTimeWindowHours.max.toFixed(1)} hrs`
  }, [quote])
  const feasibilityScorecard = useMemo(() => buildFeasibilityScorecard({
    material: materialChoice,
    printabilityScore: quote?.pricing ? Math.max(0, Math.min(100, 92 - (quote.pricing.hours * 6))) : 72,
    failureRiskScore: typeof quote?.etaConfidenceScore === 'number' ? Math.max(0, 100 - Math.round(quote.etaConfidenceScore * 100)) : 32,
    supportLikelihood: typeof quote?.pricing?.machineCost === 'number' && typeof quote?.pricing?.laborCost === 'number' && typeof quote?.pricing?.price === 'number' && quote.pricing.price > 0
      ? Math.max(0, Math.min(1, (quote.pricing.machineCost + quote.pricing.laborCost) / quote.pricing.price))
      : null,
    sizeXmm: targetDimensions?.x ?? sizeXmm ?? null,
    sizeYmm: targetDimensions?.y ?? sizeYmm ?? null,
    sizeZmm: targetDimensions?.z ?? sizeZmm ?? null,
  }), [materialChoice, quote, sizeXmm, sizeYmm, sizeZmm, targetDimensions])
  const materialRecommendations = useMemo(() => recommendMaterials({
    currentMaterial: materialChoice,
    failureRiskScore: typeof quote?.etaConfidenceScore === 'number' ? Math.max(0, 100 - Math.round(quote.etaConfidenceScore * 100)) : null,
    printabilityScore: feasibilityScorecard.score,
    ...materialGoals,
  }), [materialChoice, quote?.etaConfidenceScore, feasibilityScorecard.score, materialGoals])

  const materialOptions = useMemo(() => {
    const normalized = normalizeMaterialName(materialChoice)
    const options = MATERIAL_OPTIONS.map((option) => String(option))
    if (!options.includes(normalized)) options.push(normalized)
    return options
  }, [materialChoice])
  const paletteLookup = useMemo(() => {
    const map = new Map<string, { name: string; hex: string }>()
    for (const swatch of COLOR_PALETTE) {
      map.set(normalizeColorValue(swatch.name), swatch)
      map.set(normalizeColorValue(swatch.hex), swatch)
    }
    return map
  }, [])
  const activeMaterialKey = normalizeMaterialName(materialChoice)
  const stockworksEntry = stockworksPalette?.materials?.[activeMaterialKey]
  const paletteOptions = useMemo<SwatchOption[]>(() => {
    if (!stockworksEntry || (stockworksEntry.inStock.length === 0 && stockworksEntry.orderable.length === 0)) {
      const basePalette = COLOR_PALETTE.map((swatch) => ({ ...swatch, brand: '', paint: swatch.hex }))
      return allowedColorTokens
        ? basePalette.filter((swatch) => isColorAllowed(`${swatch.name} ${swatch.hex}`, allowedColorTokens))
        : basePalette
    }
    const inStockSet = new Set(stockworksEntry.inStock.map((color) => normalizeColorKey(color as StockworksColor | string)))
    const ordered = [...stockworksEntry.inStock, ...stockworksEntry.orderable]
    const seen = new Set<string>()
    const output: SwatchOption[] = []
    for (const color of ordered) {
      const colorMeta = toColorMeta(color as StockworksColor | string)
      const normalized = normalizeColorValue(colorMeta.name || colorMeta.hex)
      const brandNormalized = normalizeColorValue(colorMeta.brand)
      const categoryNormalized = normalizeColorValue(colorMeta.category)
      const scope = [brandNormalized, categoryNormalized].filter(Boolean).join('::')
      const uniqueKey = scope ? `${scope}::${normalized}` : normalized
      if (!normalized || seen.has(uniqueKey)) continue
      seen.add(uniqueKey)
      const swatch = paletteLookup.get(normalized)
      const hex = colorMeta.hex || swatch?.hex || (isHexColor(colorMeta.name) ? colorMeta.name : COLOR_PICKER_FALLBACK)
      const paint = resolveColorPaint({
        name: colorMeta.name || swatch?.name || colorMeta.hex || 'Unknown',
        hex,
        category: colorMeta.category || '',
        fallback: COLOR_PICKER_FALLBACK,
      })
      output.push({
        name: colorMeta.name || swatch?.name || colorMeta.hex || 'Unknown',
        hex,
        paint,
        inStock: inStockSet.has(uniqueKey),
        brand: colorMeta.brand || '',
        category: colorMeta.category || '',
      })
    }
    return allowedColorTokens
      ? output.filter((swatch) => isColorAllowed(`${swatch.name} ${swatch.hex}`, allowedColorTokens))
      : output
  }, [stockworksEntry, paletteLookup, allowedColorTokens])
  const paletteValueToHex = useMemo(() => {
    const map = new Map<string, string>()
    for (const swatch of paletteOptions) {
      if (swatch.name) map.set(normalizeColorValue(swatch.name), swatch.hex)
      if (swatch.hex) map.set(normalizeColorValue(swatch.hex), swatch.hex)
    }
    return map
  }, [paletteOptions])
  const paletteValueToPaint = useMemo(() => {
    const map = new Map<string, string>()
    for (const swatch of paletteOptions) {
      if (swatch.name) map.set(normalizeColorValue(swatch.name), swatch.paint)
      if (swatch.hex) map.set(normalizeColorValue(swatch.hex), swatch.paint)
    }
    return map
  }, [paletteOptions])
  const resolveColorHex = useCallback((value?: string | null) => {
    const parsed = parseColorString(value)
    const swatch = resolveSwatch(value)
    const normalized = normalizeColorValue(parsed.name || parsed.hex || value)
    const lookup = paletteValueToHex.get(normalized) || ''
    const candidate = parsed.hex || swatch?.hex || lookup
    return candidate ? normalizeHexColor(candidate) : ''
  }, [paletteValueToHex])
  const blendHexes = useMemo(
    () => normalizedColors.map((value) => resolveColorHex(value)).filter(Boolean),
    [normalizedColors, resolveColorHex],
  )
  const blendGradient = useMemo(() => buildBlendGradient(blendHexes), [blendHexes])
  const blendPairs = useMemo(
    () => blendHexes.slice(0, -1).map((hex, idx) => ({
      from: hex,
      to: blendHexes[idx + 1],
      mixed: mixHex(hex, blendHexes[idx + 1]),
      label: `S${idx + 1}→S${idx + 2}`,
    })),
    [blendHexes],
  )
  const fallbackBrandLabel = stockworksEntry ? 'Other' : 'Palette'
  const fallbackCategoryLabel = 'Other'
  const hasCategory = useMemo(() => paletteOptions.some((swatch) => (swatch.category || '').trim()), [paletteOptions])
  const paletteGroups = useMemo(() => {
    const groups: { label: string; categories: { label: string; options: SwatchOption[] }[] }[] = []
    const brandMap = new Map<string, { label: string; categories: Map<string, SwatchOption[]>; list: { label: string; options: SwatchOption[] }[] }>()
    for (const swatch of paletteOptions) {
      const brandLabel = (swatch.brand || '').trim() || fallbackBrandLabel
      const brandKey = normalizeColorValue(brandLabel)
      let brandGroup = brandMap.get(brandKey)
      if (!brandGroup) {
        brandGroup = { label: brandLabel, categories: new Map(), list: [] }
        brandMap.set(brandKey, brandGroup)
        groups.push({ label: brandLabel, categories: brandGroup.list })
      }
      const categoryLabel = hasCategory ? ((swatch.category || '').trim() || fallbackCategoryLabel) : ''
      const categoryKey = hasCategory ? normalizeColorValue(categoryLabel || fallbackCategoryLabel) : 'default'
      let categoryList = brandGroup.categories.get(categoryKey)
      if (!categoryList) {
        categoryList = []
        brandGroup.categories.set(categoryKey, categoryList)
        brandGroup.list.push({ label: categoryLabel, options: categoryList })
      }
      categoryList.push(swatch)
    }
    return groups
  }, [paletteOptions, fallbackBrandLabel, fallbackCategoryLabel, hasCategory])
  const paletteTitle = stockworksEntry ? 'Filament brands' : 'Palette'

  const updateTargetDimension = useCallback((axis: DimensionAxis, nextValue: number) => {
    if (!hasDimensions) return
    const baseValue = axis === 'x' ? sizeXmm : axis === 'y' ? sizeYmm : sizeZmm
    if (typeof baseValue !== 'number' || !Number.isFinite(baseValue) || baseValue <= 0) return
    if (!Number.isFinite(nextValue) || nextValue <= 0) return
    const nextScale = clampScale(nextValue / baseValue)
    if (lockDimensions) {
      setScale(nextScale)
      setDimensionOverrides(null)
    } else {
      setDimensionOverrides((prev) => {
        const next = { ...(prev || {}) }
        next[axis] = nextScale
        return next
      })
    }
  }, [hasDimensions, lockDimensions, sizeXmm, sizeYmm, sizeZmm])

  const toggleLock = useCallback(() => {
    if (lockDimensions) {
      setDimensionOverrides({
        x: axisScale.x,
        y: axisScale.y,
        z: axisScale.z,
      })
      setLockDimensions(false)
    } else {
      setLockDimensions(true)
      setDimensionOverrides(null)
    }
  }, [lockDimensions, axisScale])

  const resetDimensions = useCallback(() => {
    setScale(1)
    setDimensionOverrides(null)
    setLockDimensions(true)
  }, [])

  useEffect(() => {
    if (!hasDimensions) return
    setDimensionInputs((prev) => {
      let next: Record<DimensionAxis, string> | null = null
      for (const axis of DIMENSION_AXES) {
        if (axis === activeDimensionAxis) continue
        const value = targetDimensions?.[axis]
        const nextValue = value != null ? String(value) : ''
        if (prev[axis] !== nextValue) {
          next = next ?? { ...prev }
          next[axis] = nextValue
        }
      }
      return next ?? prev
    })
  }, [hasDimensions, targetDimensions, activeDimensionAxis])

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/models/${modelId}/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(quoteRequestPayload),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          throw new Error(payload?.error || 'Unable to fetch quote')
        }
        const data = await res.json() as QuoteResponse & { pending?: boolean }
        if (!active) return
        if (data.pending) {
          setQuote(null)
          return
        }
        setQuote(data.quote)
      } catch (err: any) {
        if (!active) return
        setError(err?.message || 'Unable to fetch quote')
        setQuote(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [modelId, quoteRequestPayload])

  useEffect(() => {
    let active = true
    fetch('/api/stockworks/filament-colors', { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return
        if (!data?.enabled) {
          setStockworksPalette(null)
          return
        }
        setStockworksPalette(data)
      })
      .catch(() => {
        if (active) setStockworksPalette(null)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (activeColorSlot == null) return
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (paletteRef.current?.contains(target)) return
      if (target.closest(`[data-color-slot="color-slot-${activeColorSlot}"]`)) return
      setActiveColorSlot(null)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveColorSlot(null)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [activeColorSlot])

  const addToCart = useCallback(() => {
    if (!hasRequiredColor) return
    const opts = {
      qty: 1,
      scale: clampScale(scale),
      material: materialChoice,
      colors: normalizedColors,
      toleranceClass,
      finish,
      infillPct,
      priceMultiplier: TOLERANCE_OPTIONS.find((option) => option.value === toleranceClass)?.multiplier ?? 1,
      dimensionOverrides: lockDimensions ? null : dimensionOverrides,
      lockDimensions,
    }
    if (parts && parts.length > 1) {
      for (const part of parts) {
        add(
          {
            modelId,
            partId: part.id,
            partName: part.name || undefined,
            partIndex: typeof part.index === 'number' ? part.index : undefined,
            flatRatePricing: Boolean(flatRatePricing),
            title,
            priceUsd: part.priceUsd ?? null,
            thumbnail: thumbnail ?? null,
            size: { x: part.sizeXmm ?? undefined, y: part.sizeYmm ?? undefined, z: part.sizeZmm ?? undefined },
            colorSlotCount: configuredSlotCount,
            allowedColors: allowedColorList,
          },
          opts,
        )
      }
      return
    }
    add(
      {
        modelId,
        flatRatePricing: Boolean(flatRatePricing),
        title,
        priceUsd: priceUsd ?? quote?.priceUsd ?? null,
        thumbnail: thumbnail ?? null,
        size: { x: sizeXmm ?? undefined, y: sizeYmm ?? undefined, z: sizeZmm ?? undefined },
        colorSlotCount: configuredSlotCount,
        allowedColors: allowedColorList,
      },
      opts,
    )
  }, [add, hasRequiredColor, modelId, title, priceUsd, quote?.priceUsd, thumbnail, sizeXmm, sizeYmm, sizeZmm, scale, materialChoice, normalizedColors, toleranceClass, finish, infillPct, lockDimensions, dimensionOverrides, flatRatePricing, parts, configuredSlotCount, allowedColorList])

  const uploadGcode = async (file: File) => {
    setGcodeLoading(true)
    setGcodeError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('material', materialChoice)
      form.append('qty', '1')
      form.append('rush', rush ? 'true' : 'false')
      const res = await fetch('/api/estimate/gcode', { method: 'POST', body: form })
      const data = await res.json().catch(() => null) as GcodeEstimate | null
      if (!res.ok || !data?.estimate) {
        throw new Error((data as any)?.error || 'Unable to parse G-code.')
      }
      setGcodeEstimate(data.estimate)
    } catch (err: any) {
      setGcodeError(err?.message || 'Unable to parse G-code.')
      setGcodeEstimate(null)
    } finally {
      setGcodeLoading(false)
    }
  }

  const downloadManufacturabilityReport = useCallback(async () => {
    setReportLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/models/${modelId}/manufacturability-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteRequestPayload),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || 'Unable to generate manufacturability report.')
      }
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = `manufacturability-${modelId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(href)
    } catch (err: any) {
      setError(err?.message || 'Unable to generate manufacturability report.')
    } finally {
      setReportLoading(false)
    }
  }, [modelId, quoteRequestPayload])

  const activeSlotValue = activeColorSlot != null ? colors[activeColorSlot] || '' : ''
  const activeSlotParsed = parseColorString(activeSlotValue)
  const activeSlotSwatch = resolveSwatch(activeSlotValue)
  const activeSlotNormalized = normalizeColorValue(activeSlotParsed.name || activeSlotParsed.hex || activeSlotValue)
  const activeSlotHexValue = isHexColor(activeSlotValue)
    ? activeSlotValue
    : activeSlotSwatch?.hex
      || activeSlotParsed.hex
      || paletteValueToHex.get(activeSlotNormalized)
      || COLOR_PICKER_FALLBACK

  const updateColorAt = useCallback((index: number, nextValue: string) => {
    if (!isColorAllowed(nextValue, allowedColorTokens)) return
    setColors((prev) => {
      const next = prev.slice()
      next[index] = nextValue
      return next
    })
  }, [allowedColorTokens])

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Instant quote</h3>
          <p className="text-xs text-slate-400">Tune this model and save the configuration to your cart.</p>
        </div>
        <button className="btn" onClick={addToCart} disabled={loading || !hasRequiredColor}>
          Save to cart
        </button>
      </div>
      {(loading || gcodeLoading || reportLoading) && (
        <div className="flex flex-wrap gap-2">
          {loading && <StatusChip label="Refreshing quote" tone="info" pulse />}
          {gcodeLoading && <StatusChip label="Parsing G-code" tone="info" pulse />}
          {reportLoading && <StatusChip label="Generating PDF" tone="warning" pulse />}
        </div>
      )}
      {error && <div className="text-xs text-amber-300">{error}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Material</span>
          <select className="input" value={materialChoice} onChange={(e) => setMaterialChoice(e.target.value as MaterialType)}>
            {materialOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Finish</span>
          <select className="input" value={finish} onChange={(e) => setFinish(e.target.value)}>
          {FINISH_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="text-sm space-y-1">
        <span className="text-slate-400">Tolerance class</span>
        <select className="input" value={toleranceClass} onChange={(e) => setToleranceClass(e.target.value as ToleranceClass)}>
          {TOLERANCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Infill %</span>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            value={infillPct}
            onChange={(e) => setInfillPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Scale</span>
          <input
            className="input"
            type="number"
            min={SCALE_MIN}
            max={SCALE_MAX}
            step={0.05}
            value={scale.toFixed(2)}
            onChange={(e) => setScale(clampScale(Number(e.target.value)))}
          />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Rush pricing</span>
          <button
            type="button"
            className={`input text-left ${rush ? 'border-amber-400/60 text-amber-200' : ''}`}
            onClick={() => setRush((prev) => !prev)}
          >
            {rush ? 'Enabled' : 'Standard'}
          </button>
        </label>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Use-case goals</div>
          <p className="mt-1 text-xs text-slate-400">Drive material recommendations with the actual part constraints.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2 text-sm">
          {[
            ['needImpactResistance', 'Impact resistance'],
            ['needHeatResistance', 'Heat resistance'],
            ['needUvResistance', 'UV / outdoor'],
            ['needFlexibility', 'Flexibility'],
            ['budgetSensitive', 'Budget sensitive'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(materialGoals[key as keyof typeof materialGoals])}
                onChange={(e) => setMaterialGoals((prev) => ({ ...prev, [key]: e.target.checked }))}
              />
            </label>
          ))}
        </div>
      </div>
      {hasDimensions && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Target dimensions (mm)</span>
            <button type="button" className="px-2 py-1 rounded border border-white/10 hover:border-white/20" onClick={toggleLock}>
              {lockDimensions ? 'Ratio locked' : 'Ratio free'}
            </button>
            <button type="button" className="px-2 py-1 rounded border border-white/10 hover:border-white/20" onClick={resetDimensions}>
              Reset
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {DIMENSION_AXES.map((axis) => {
              const value = dimensionInputs[axis]
              return (
                <label key={axis} className="text-xs text-slate-400 space-y-1">
                  <span>{axis.toUpperCase()}</span>
                  <input
                    className="input"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={value}
                    onFocus={() => setActiveDimensionAxis(axis)}
                    onBlur={() => {
                      setActiveDimensionAxis(null)
                      const parsed = Number(value)
                      if (Number.isFinite(parsed) && parsed > 0) updateTargetDimension(axis, parsed)
                    }}
                    onChange={(e) => {
                      const nextValue = e.target.value
                      setDimensionInputs((prev) => ({ ...prev, [axis]: nextValue }))
                      const parsed = Number(nextValue)
                      if (Number.isFinite(parsed) && parsed > 0) updateTargetDimension(axis, parsed)
                    }}
                  />
                </label>
              )
            })}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Colors (required)</span>
          <button
            type="button"
            className="px-2 py-1 rounded border border-white/10 hover:border-white/20"
            onClick={() => {
              if (colors.length >= slotLimit) return
              setColors((prev) => [...prev, ''])
            }}
          >
            Add color
          </button>
        </div>
        {!hasRequiredColor && (
          <p className="text-xs text-amber-300">Choose at least one filament color before saving to cart.</p>
        )}
        <div className="grid gap-2 md:grid-cols-2">
          {colors.map((color, idx) => {
            const slotId = `color-slot-${idx}`
            const swatch = resolveSwatch(color)
            const parsedValue = parseColorString(color)
            const normalizedValue = normalizeColorValue(parsedValue.name || parsedValue.hex || color)
            const hexValue = isHexColor(color)
              ? color
              : swatch?.hex
                || parsedValue.hex
                || paletteValueToHex.get(normalizedValue)
                || COLOR_PICKER_FALLBACK
            const paintValue = paletteValueToPaint.get(normalizedValue)
              || resolveColorPaint({
                name: parsedValue.name || swatch?.name || color,
                hex: hexValue,
                fallback: COLOR_PICKER_FALLBACK,
              })
            const isActive = activeColorSlot === idx
            return (
              <div key={`${modelId}-color-${idx}`} className="flex items-center gap-2">
                <button
                  type="button"
                  data-color-slot={slotId}
                  className={`relative h-12 w-12 rounded-xl border border-white/20 flex items-center justify-center transition-all ${isActive ? 'ring-2 ring-amber-400' : ''}`}
                  style={{ background: paintValue }}
                  onClick={() => setActiveColorSlot((prev) => (prev === idx ? null : idx))}
                >
                  {!color && <span className="text-[9px] uppercase tracking-wide text-white/70">Pick</span>}
                </button>
                <div className="flex-1">
                  <div className="text-xs text-slate-400">Slot {idx + 1}</div>
                  <div className="text-sm text-slate-100 truncate">{color || 'No color selected'}</div>
                </div>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-white/10 hover:border-white/20 text-xs"
                  onClick={() => {
                    setColors((prev) => prev.filter((_, i) => i !== idx))
                    setActiveColorSlot((prev) => {
                      if (prev == null) return prev
                      if (prev === idx) return null
                      return prev > idx ? prev - 1 : prev
                    })
                  }}
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      </div>
      {blendHexes.length >= 2 && (
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-300 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">AMS blend preview</div>
          <div className="h-2 rounded-full border border-white/10" style={{ background: blendGradient }} />
          <div className="flex flex-wrap gap-2">
            {blendPairs.map((pair) => (
              <div key={pair.label} className="flex items-center gap-1 text-[9px] text-slate-400">
                <span
                  className="h-4 w-4 rounded-full border border-white/20"
                  style={{ background: `linear-gradient(135deg, ${pair.from}, ${pair.to})` }}
                />
                <span className="text-[8px] uppercase tracking-wide">{pair.label}</span>
                {pair.mixed ? (
                  <span className="h-3 w-3 rounded-full border border-white/20" style={{ background: pair.mixed }} />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-sm flex items-center justify-between">
        <div>
          <div className="text-slate-400 text-xs">Estimated price</div>
          <div className="text-lg font-semibold">
            {gcodeEstimate
              ? formatCurrency(gcodeEstimate.priceUsd)
              : (quote ? formatCurrency(quote.priceUsd) : (priceUsd ? formatCurrency(priceUsd) : '...'))}
          </div>
          <div className="text-xs text-slate-400">
            Lead time: {quote
              ? `${quote.leadTimeHours.toFixed(1)} hrs${quote.leadTimeWindowHours ? ` (${quote.leadTimeWindowHours.min.toFixed(1)}-${quote.leadTimeWindowHours.max.toFixed(1)} hrs)` : ''}${typeof quote.etaConfidenceScore === 'number' ? ` • ${Math.round(quote.etaConfidenceScore * 100)}% confidence` : ''}`
              : '...'}
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          {targetDimensions
            ? `Size: ${DIMENSION_AXES.map((axis) => targetDimensions?.[axis]).filter(Boolean).join(' x ')} mm`
            : 'Size pending'}
          <div className="mt-1">{TOLERANCE_OPTIONS.find((option) => option.value === toleranceClass)?.label} tolerance</div>
          <button
            type="button"
            onClick={downloadManufacturabilityReport}
            disabled={reportLoading}
            className="mt-2 block ml-auto px-2 py-1 rounded border border-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reportLoading ? 'Generating PDF...' : 'Manufacturability PDF'}
          </button>
        </div>
      </div>
      <FeasibilityScorecard scorecard={feasibilityScorecard} />
      <MaterialRecommenderCard
        recommendations={materialRecommendations}
        currentMaterial={materialChoice}
        onSelect={(nextMaterial) => setMaterialChoice(nextMaterial as MaterialType)}
      />
      <QuoteBreakdownCard
        pricing={quote?.pricing || null}
        unitPrice={gcodeEstimate?.priceUsd ?? quote?.priceUsd ?? null}
        varianceLabel={quoteVarianceLabel}
        confidenceScore={quote?.etaConfidenceScore ?? null}
        adjustments={quote?.adjustments || null}
        leadTimeSignals={quote?.leadTimeSignals || null}
      />
      <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-300 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">G-code import</p>
            <p className="text-slate-400">Drop a slicer-exported G-code for a tighter estimate.</p>
          </div>
          {gcodeEstimate && (
            <button
              type="button"
              className="px-2 py-1 rounded border border-white/10 hover:border-white/20 text-[11px]"
              onClick={() => setGcodeEstimate(null)}
            >
              Clear
            </button>
          )}
        </div>
        <input
          type="file"
          accept=".gcode,.gc,.gco,.ngc,.txt"
          className="block w-full text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadGcode(file)
          }}
        />
        {gcodeLoading && <StatusChip label="Parsing G-code for tighter timing and material estimates" tone="info" pulse />}
        {gcodeError && <div className="text-amber-300">{gcodeError}</div>}
        {gcodeEstimate && (
          <div className="text-slate-400 space-y-1">
            <div>Estimated material: {gcodeEstimate.filamentMm ? `${Math.round(gcodeEstimate.filamentMm)} mm` : 'Unknown'}</div>
            {gcodeEstimate.estimatedSeconds != null && (
              <div>Estimated time: {(gcodeEstimate.estimatedSeconds / 3600).toFixed(2)} hrs</div>
            )}
            {gcodeEstimate.materialBreakdown && gcodeEstimate.materialBreakdown.length > 0 && (
              <div>
                Materials: {gcodeEstimate.materialBreakdown.map((row) => `${row.material} ${Math.round(row.filamentMm)}mm`).join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
      {activeColorSlot != null && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" />
          <div
            ref={paletteRef}
            className="absolute left-1/2 top-1/2 w-[320px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-950/95 p-3 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between mb-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
              <span>Slot {activeColorSlot + 1}</span>
              <button
                type="button"
                className="px-2 py-1 rounded-full border border-white/10 text-[9px] uppercase tracking-wide hover:border-white/30"
                onClick={() => setActiveColorSlot(null)}
              >
                Close
              </button>
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{paletteTitle}</div>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide text-slate-500 mt-2">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-emerald-300/70" />
                In stock
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full border border-slate-500" />
                Orderable
              </div>
            </div>
            <div className="mt-2 rounded-lg border border-white/10 bg-slate-900/70 p-2 max-h-[240px] overflow-y-auto">
              <div className="space-y-3">
                {paletteGroups.map((group) => (
                  <div key={group.label}>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">{group.label}</div>
                    {group.categories.map((category) => (
                      <div key={`${group.label}-${category.label || 'default'}`} className="mb-3 last:mb-0">
                        {hasCategory && (
                          <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-2">{category.label}</div>
                        )}
                        <div className="grid grid-cols-6 gap-2">
                          {category.options.map((swatchOption) => {
                            const swatchNormalized = normalizeColorValue(swatchOption.name || swatchOption.hex)
                            const isSelected = activeSlotNormalized === swatchNormalized
                              || activeSlotNormalized === normalizeColorValue(swatchOption.hex)
                            const ringCls = isSelected
                              ? 'ring-2 ring-amber-400'
                              : swatchOption.inStock
                                ? 'ring-2 ring-emerald-400/80'
                                : ''
                            const availabilityLabel = swatchOption.inStock ? 'In stock' : 'Orderable'
                            return (
                              <button
                                key={`${swatchOption.brand || 'palette'}-${swatchOption.name}-${swatchOption.hex}`}
                                type="button"
                                title={
                                  swatchOption.inStock
                                    ? `${swatchOption.name} (${swatchOption.hex}) - In stock`
                                    : `${swatchOption.name} (${swatchOption.hex})`
                                }
                                className={`relative h-8 w-8 rounded-full border border-white/30 transition-transform hover:scale-105 ${ringCls}`}
                                style={{ background: swatchOption.paint }}
                                aria-label={`Select ${swatchOption.name}`}
                                onClick={() => {
                                  const nextValue = swatchOption.name && swatchOption.hex
                                    ? `${swatchOption.name} ${swatchOption.hex}`
                                    : swatchOption.name || swatchOption.hex
                                  updateColorAt(activeColorSlot, nextValue)
                                }}
                              >
                                <span className="sr-only">{swatchOption.name}</span>
                                <span
                                  className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${
                                    swatchOption.inStock ? 'bg-emerald-400' : 'bg-slate-700'
                                  } border border-slate-900`}
                                  aria-hidden="true"
                                  title={availabilityLabel}
                                />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <input
                className="w-full input text-sm"
                value={activeSlotValue}
                placeholder="Name or hex"
                onChange={(e) => updateColorAt(activeColorSlot, e.target.value)}
              />
              <label className="text-[10px] uppercase tracking-wide text-slate-400">
                Custom color
                <input
                  type="color"
                  className="mt-1 h-10 w-full rounded-md border border-white/20 bg-transparent cursor-pointer"
                  value={activeSlotHexValue}
                  aria-label={`Pick color ${activeColorSlot + 1}`}
                  onChange={(e) => updateColorAt(activeColorSlot, e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
