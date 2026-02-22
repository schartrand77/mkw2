"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCart } from '@/components/cart/CartProvider'
import { formatCurrency } from '@/lib/currency'
import { toPublicHref } from '@/lib/public-path'
import {
  clampScale,
  DIMENSION_AXES,
  getColorMultiplier,
  getFinishMultiplier,
  getMaterialMultiplier,
  getVolumeScaleMultiplier,
  MATERIAL_OPTIONS,
  normalizeColors,
  normalizeMaterialName,
  resolveAxisScale,
  type MaterialType,
} from '@/lib/cartPricing'
import { buildAllowedColorTokenSet, isColorAllowed, normalizeModelColorSlotCount } from '@/lib/color-constraints'
import type { DiscountSummary } from '@/lib/discounts'
import { getDiscountMultiplier } from '@/lib/discounts'
import { applyPricingAdjustments, resolveBatchDiscountPercent } from '@/lib/estimate-adjustments'

const LazyModelViewer = dynamic(() => import('@/components/ModelViewer'), { ssr: false })

const AXIS_LABELS: Record<(typeof DIMENSION_AXES)[number], string> = {
  x: 'Width (X)',
  y: 'Depth (Y)',
  z: 'Height (Z)',
}
const COLOR_PICKER_FALLBACK = '#1f2937'
const PREVIEW_DEFAULT_COLOR = '#f8fafc'
const PALETTE_MARGIN = 16
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
type StockworksWarning = {
  status: 'in_stock' | 'limited' | 'out_of_stock'
  quantityGrams: number
  limitedThresholdGrams: number
  leadTimeDays?: number | null
}
type StockworksWarningResponse = {
  enabled: boolean
  materials: Record<string, StockworksWarning>
  updatedAt?: string
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
  inStock?: boolean
  brand?: string
  category?: string
}
type ModelPreviewPart = {
  id: string
  filePath: string
  previewFilePath?: string | null
}
type ModelPreviewEntry = {
  filePath: string | null
  viewerFilePath: string | null
  parts: ModelPreviewPart[]
}
type CustomerPreset = {
  id: string
  name: string
  data: {
    material?: string | null
    colors?: string[] | null
    finish?: string | null
    infillPct?: number | null
    scale?: number | null
    priceMultiplier?: number | null
  }
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

const normalizeHexColor = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed.startsWith('#')) return ''
  const hex = trimmed.slice(1)
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
  }
  if (hex.length === 6) return `#${hex}`
  if (hex.length === 8) return `#${hex.slice(2)}`
  return ''
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

const resolveColorHex = (value?: string | null) => {
  const parsed = parseColorString(value)
  const swatch = resolveSwatch(value)
  const candidate = parsed.hex || swatch?.hex || ''
  return candidate ? normalizeHexColor(candidate) : ''
}

export default function CartPage() {
  const { items, inc, dec, update, remove, clear, maxColors, pricingAdjustments, minimumOrder } = useCart()
  const [discount, setDiscount] = useState<DiscountSummary | null>(null)
  const [rush, setRush] = useState(false)
  const [activeColorSlot, setActiveColorSlot] = useState<{ id: string; modelId: string; partId: string | null; index: number } | null>(null)
  const [activeColorAnchor, setActiveColorAnchor] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [paletteWidth, setPaletteWidth] = useState<number | null>(null)
  const [paletteMaxHeight, setPaletteMaxHeight] = useState<number | null>(null)
  const [palettePlacement, setPalettePlacement] = useState<'above' | 'below'>('below')
  const [isMobilePalette, setIsMobilePalette] = useState(false)
  const [stockworksPalette, setStockworksPalette] = useState<StockworksPalette | null>(null)
  const [materialWarnings, setMaterialWarnings] = useState<StockworksWarningResponse | null>(null)
  const [modelPreviewCache, setModelPreviewCache] = useState<Record<string, ModelPreviewEntry>>({})
  const [dimensionInputs, setDimensionInputs] = useState<Record<string, Record<(typeof DIMENSION_AXES)[number], string>>>({})
  const [activeDimensionInput, setActiveDimensionInput] = useState<{ key: string; axis: (typeof DIMENSION_AXES)[number] } | null>(null)
  const [selectedPreviewKey, setSelectedPreviewKey] = useState<{ modelId: string; partId: string | null } | null>(null)
  const [presets, setPresets] = useState<CustomerPreset[]>([])
  const [presetError, setPresetError] = useState<string | null>(null)
  const [presetNames, setPresetNames] = useState<Record<string, string>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)
  const paletteRef = useRef<HTMLDivElement | null>(null)
  const searchParams = useSearchParams()
  const previewParamRef = useRef<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mwv2:cart:rush')
      if (stored) setRush(stored === '1')
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('mwv2:cart:rush', rush ? '1' : '0')
    } catch {}
  }, [rush])

  useEffect(() => {
    let active = true
    fetch('/api/discount', { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setDiscount(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/presets', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((data) => {
        if (!active || !data?.presets) return
        setPresets(Array.isArray(data.presets) ? data.presets : [])
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)')
    const handleChange = () => setIsMobilePalette(query.matches)
    handleChange()
    if (query.addEventListener) query.addEventListener('change', handleChange)
    else query.addListener(handleChange)
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', handleChange)
      else query.removeListener(handleChange)
    }
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/stockworks/filament-colors', { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.enabled) return
        setStockworksPalette(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const cartMaterials = useMemo(() => {
    const unique = new Set<string>()
    for (const item of items) {
      const key = normalizeMaterialName(item.options.material || 'PLA')
      if (key) unique.add(key)
    }
    return Array.from(unique)
  }, [items])

  useEffect(() => {
    let active = true
    if (cartMaterials.length === 0) {
      setMaterialWarnings(null)
      return () => { active = false }
    }
    const qs = cartMaterials.join(',')
    fetch(`/api/stockworks/material-warnings?materials=${encodeURIComponent(qs)}`, { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.enabled) return
        setMaterialWarnings(data)
      })
      .catch(() => {})
    return () => { active = false }
  }, [cartMaterials])

  useEffect(() => {
    if (!activeColorSlot) return
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (paletteRef.current?.contains(target)) return
      if (target.closest(`[data-color-slot="${activeColorSlot.id}"]`)) return
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

  useEffect(() => {
    if (!activeColorSlot) {
      setActiveColorAnchor(null)
      setPaletteWidth(null)
      setPaletteMaxHeight(null)
      return
    }
    const updateAnchor = () => {
      const button = document.querySelector(`[data-color-slot="${activeColorSlot.id}"]`)
      if (!button) return
      const rect = (button as HTMLElement).getBoundingClientRect()
      const containerRect = containerRef.current?.getBoundingClientRect()
      const availableWidth = Math.max(0, window.innerWidth - PALETTE_MARGIN * 2)
      const targetWidth = Math.max(320, Math.min(containerRect?.width ?? availableWidth, availableWidth))
      const verticalGap = 12
      const availableBelow = Math.max(0, window.innerHeight - (rect.top + rect.height + verticalGap) - PALETTE_MARGIN)
      const availableAbove = Math.max(0, rect.top - verticalGap - PALETTE_MARGIN)
      const nextPlacement = availableAbove > availableBelow ? 'above' : 'below'
      setActiveColorAnchor({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
      setPaletteWidth(targetWidth)
      setPaletteMaxHeight(Math.max(240, nextPlacement === 'above' ? availableAbove : availableBelow))
      setPalettePlacement(nextPlacement)
    }
    updateAnchor()
    window.addEventListener('resize', updateAnchor)
    window.addEventListener('scroll', updateAnchor, true)
    return () => {
      window.removeEventListener('resize', updateAnchor)
      window.removeEventListener('scroll', updateAnchor, true)
    }
  }, [activeColorSlot])

  const activeSlotItem = activeColorSlot
    ? items.find((item) => item.modelId === activeColorSlot.modelId && (item.partId ?? null) === activeColorSlot.partId)
    : null
  const activeSlotAllowedTokens = useMemo(
    () => buildAllowedColorTokenSet(Array.isArray(activeSlotItem?.allowedColors) ? activeSlotItem.allowedColors : null),
    [activeSlotItem],
  )
  const activeSlotLocked = Boolean(activeSlotItem?.options.lockedConfig)
  const selectedPreviewItem = activeSlotItem
    || (selectedPreviewKey
      ? items.find((item) => item.modelId === selectedPreviewKey.modelId && (item.partId ?? null) === selectedPreviewKey.partId)
      : null)
    || items[0]
    || null

  useEffect(() => {
    if (!activeColorSlot) return
    setSelectedPreviewKey({ modelId: activeColorSlot.modelId, partId: activeColorSlot.partId })
  }, [activeColorSlot])

  useEffect(() => {
    if (!selectedPreviewKey) return
    const exists = items.some((item) => item.modelId === selectedPreviewKey.modelId && (item.partId ?? null) === selectedPreviewKey.partId)
    if (!exists) setSelectedPreviewKey(null)
  }, [items, selectedPreviewKey])

  useEffect(() => {
    const previewModelId = searchParams?.get('previewModelId')?.trim() || ''
    if (!previewModelId) return
    const previewPartRaw = searchParams?.get('previewPartId')
    const previewPartId = previewPartRaw ? previewPartRaw.trim() : ''
    const key = `${previewModelId}::${previewPartId}`
    if (previewParamRef.current === key) return
    const match = items.find((item) => item.modelId === previewModelId && (item.partId ?? '') === previewPartId)
    if (!match) return
    previewParamRef.current = key
    setSelectedPreviewKey({ modelId: match.modelId, partId: match.partId ?? null })
  }, [items, searchParams])

  useEffect(() => {
    if (!selectedPreviewItem) return
    const modelId = selectedPreviewItem.modelId
    if (modelPreviewCache[modelId]) return
    let active = true
    fetch(`/api/models/${modelId}`, { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.model) return
        const model = data.model as { filePath?: string | null; viewerFilePath?: string | null; parts?: any[] }
        const parts = Array.isArray(model.parts)
          ? model.parts
            .map((part) => ({
              id: String(part?.id ?? ''),
              filePath: String(part?.filePath ?? ''),
              previewFilePath: typeof part?.previewFilePath === 'string' ? part.previewFilePath : null,
            }))
            .filter((part) => part.id && part.filePath)
          : []
        setModelPreviewCache((prev) => {
          if (prev[modelId]) return prev
          return {
            ...prev,
            [modelId]: {
              filePath: typeof model.filePath === 'string' ? model.filePath : null,
              viewerFilePath: typeof model.viewerFilePath === 'string' ? model.viewerFilePath : null,
              parts,
            },
          }
        })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [selectedPreviewItem, modelPreviewCache])

  const activeSlotValue = activeColorSlot && activeSlotItem ? activeSlotItem.options.colors?.[activeColorSlot.index] || '' : ''
  const activeSlotParsed = parseColorString(activeSlotValue)
  const activeSlotSwatch = resolveSwatch(activeSlotValue)
  const activeSlotNormalized = normalizeColorValue(activeSlotParsed.name || activeSlotParsed.hex || activeSlotValue)
  const paletteLookup = useMemo(() => {
    const map = new Map<string, { name: string; hex: string }>()
    for (const swatch of COLOR_PALETTE) {
      map.set(normalizeColorValue(swatch.name), swatch)
      map.set(normalizeColorValue(swatch.hex), swatch)
    }
    return map
  }, [])
  const activeMaterialKey = normalizeMaterialName(activeSlotItem?.options.material)
  const stockworksEntry = stockworksPalette?.materials?.[activeMaterialKey]
  const materialOptions = useMemo(() => {
    const defaults = MATERIAL_OPTIONS.map((material) => material.toUpperCase())
    const fromStockworks = stockworksPalette?.materialTypes?.length
      ? stockworksPalette.materialTypes.map((key) => key.toUpperCase())
      : (stockworksPalette?.materials ? Object.keys(stockworksPalette.materials).map((key) => key.toUpperCase()) : [])
    const output: string[] = []
    const seen = new Set<string>()
    for (const material of [...defaults, ...fromStockworks]) {
      const normalized = material.toUpperCase()
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      output.push(normalized)
    }
    return output.length ? output : defaults
  }, [stockworksPalette])
  const paletteOptions = useMemo<SwatchOption[]>(() => {
    if (!stockworksEntry || (stockworksEntry.inStock.length === 0 && stockworksEntry.orderable.length === 0)) {
      const basePalette = COLOR_PALETTE.map((swatch) => ({ ...swatch, brand: '' }))
      return activeSlotAllowedTokens
        ? basePalette.filter((swatch) => isColorAllowed(`${swatch.name} ${swatch.hex}`, activeSlotAllowedTokens))
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
      output.push({
        name: colorMeta.name || swatch?.name || colorMeta.hex || 'Unknown',
        hex,
        inStock: inStockSet.has(uniqueKey),
        brand: colorMeta.brand || '',
        category: colorMeta.category || '',
      })
    }
    return activeSlotAllowedTokens
      ? output.filter((swatch) => isColorAllowed(`${swatch.name} ${swatch.hex}`, activeSlotAllowedTokens))
      : output
  }, [stockworksEntry, paletteLookup, activeSlotAllowedTokens])
  const paletteValueToHex = useMemo(() => {
    const map = new Map<string, string>()
    for (const swatch of paletteOptions) {
      if (swatch.name) map.set(normalizeColorValue(swatch.name), swatch.hex)
      if (swatch.hex) map.set(normalizeColorValue(swatch.hex), swatch.hex)
    }
    return map
  }, [paletteOptions])
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
  const activeSlotHexValue = isHexColor(activeSlotValue)
    ? activeSlotValue
    : activeSlotSwatch?.hex
      || activeSlotParsed.hex
      || paletteValueToHex.get(activeSlotNormalized)
      || COLOR_PICKER_FALLBACK
  const paletteTitle = stockworksEntry ? 'Filament brands' : 'Palette'
  const selectedPreview = selectedPreviewItem ? modelPreviewCache[selectedPreviewItem.modelId] : null
  const selectedPreviewPart = selectedPreviewItem?.partId
    ? selectedPreview?.parts.find((part) => part.id === selectedPreviewItem.partId)
    : null
  const selectedPreviewSource = selectedPreviewPart?.filePath || selectedPreview?.filePath || selectedPreview?.viewerFilePath || null
  const selectedPreviewIs3mf = !!selectedPreviewSource && selectedPreviewSource.toLowerCase().endsWith('.3mf')
  const selectedPreviewFallback = selectedPreviewIs3mf
    ? (selectedPreviewPart?.previewFilePath || selectedPreview?.viewerFilePath || null)
    : null
  const selectedViewerSrc = selectedPreviewSource ? toPublicHref(selectedPreviewSource) : null
  const selectedViewerFallback = selectedPreviewFallback ? toPublicHref(selectedPreviewFallback) : null
  const selectedViewerColors = useMemo(() => {
    if (!selectedPreviewItem) return []
    const derived = (selectedPreviewItem.options.colors || []).map((value) => {
      if (isHexColor(value)) return value
      const parsed = parseColorString(value)
      const normalized = normalizeColorValue(parsed.name || parsed.hex || value)
      const swatch = resolveSwatch(value)
      return swatch?.hex
        || parsed.hex
        || paletteValueToHex.get(normalized)
        || COLOR_PICKER_FALLBACK
    })
    return derived.length > 0 ? derived : [PREVIEW_DEFAULT_COLOR]
  }, [selectedPreviewItem, paletteValueToHex])

  const discountMultiplier = useMemo(() => getDiscountMultiplier(discount), [discount])
  const totalDiscountPercent = discount?.totalPercent ?? 0
  const itemsMissingColors = useMemo(
    () => items.filter((item) => normalizeColors(item.options.colors).length === 0),
    [items],
  )
  const hasMissingColors = itemsMissingColors.length > 0
  const materialStatusEntries = useMemo(() => {
    if (!materialWarnings?.enabled) return []
    return Object.entries(materialWarnings.materials || {}).map(([material, warning]) => ({
      material,
      warning,
    }))
  }, [materialWarnings])

  const itemUnitPrice = (item: (typeof items)[number]) => {
    const base = item.priceUsd || 0
    const materialMultiplier = getMaterialMultiplier(item.options.material)
    const colorMultiplier = item.flatRatePricing ? 1 : getColorMultiplier(item.options.colors)
    const finishMultiplier = getFinishMultiplier(item.options.finish)
    const volumeMultiplier = getVolumeScaleMultiplier(item.options.scale, item.options.dimensionOverrides)
    const optionMultiplier = item.options.priceMultiplier ?? 1
    const rawUnit = base * volumeMultiplier * materialMultiplier * colorMultiplier * finishMultiplier * optionMultiplier
    const qty = Math.max(1, item.options.qty || 1)
    const batchDiscountPercent = resolveBatchDiscountPercent(qty, pricingAdjustments.batchDiscountTiers)
    const adjusted = applyPricingAdjustments({
      unitPrice: rawUnit,
      qty,
      rush,
      demandSurgeMultiplier: pricingAdjustments.demandSurgeMultiplier,
      rushMultiplier: pricingAdjustments.rushMultiplier,
      batchDiscountPercent,
    })
    return adjusted.adjustedUnitPrice
  }

  const subtotal = items.reduce((sum, item) => {
    const unit = itemUnitPrice(item)
    const qty = Math.max(1, item.options.qty || 1)
    return sum + unit * qty
  }, 0)
  const discountedSubtotal = subtotal * discountMultiplier
  const discountSavings = Math.max(0, subtotal - discountedSubtotal)
  const effectiveSubtotal = totalDiscountPercent > 0 ? discountedSubtotal : subtotal
  const minimumOrderSubtotal = typeof minimumOrder.subtotal === 'number' && Number.isFinite(minimumOrder.subtotal)
    ? minimumOrder.subtotal
    : null
  const meetsMinimumOrder = !minimumOrderSubtotal || effectiveSubtotal >= minimumOrderSubtotal
  const disableCheckout = hasMissingColors || !meetsMinimumOrder

  const applyColorRulesForItem = useCallback((item: (typeof items)[number], colors: string[]) => {
    const locked = Boolean(item.options.lockedConfig)
    const lockedSlots = Math.max(1, normalizeColors(item.options.colors).length)
    const modelSlots = normalizeModelColorSlotCount(item.colorSlotCount)
    const slotLimit = locked ? lockedSlots : (modelSlots ?? Math.max(1, maxColors))
    const allowedTokens = buildAllowedColorTokenSet(Array.isArray(item.allowedColors) ? item.allowedColors : null)
    return normalizeColors(colors, slotLimit).filter((value) => isColorAllowed(value, allowedTokens))
  }, [maxColors])

  const applyPreset = (preset: CustomerPreset, item: (typeof items)[number]) => {
    const data = preset.data || {}
    update(item.modelId, {
      material: data.material ? normalizeMaterialName(data.material) : item.options.material,
      colors: Array.isArray(data.colors) ? data.colors : item.options.colors,
      finish: data.finish ?? item.options.finish ?? null,
      infillPct: typeof data.infillPct === 'number' ? data.infillPct : item.options.infillPct ?? null,
      scale: typeof data.scale === 'number' ? clampScale(data.scale) : item.options.scale,
      priceMultiplier: typeof data.priceMultiplier === 'number' ? data.priceMultiplier : item.options.priceMultiplier ?? null,
    }, item.partId)
  }

  const savePreset = async (itemKey: string, item: (typeof items)[number]) => {
    const name = (presetNames[itemKey] || '').trim()
    if (!name) {
      setPresetError('Enter a preset name before saving.')
      return
    }
    setPresetError(null)
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          data: {
            material: item.options.material,
            colors: normalizeColors(item.options.colors),
            finish: item.options.finish ?? null,
            infillPct: item.options.infillPct ?? null,
            scale: item.options.scale,
            priceMultiplier: item.options.priceMultiplier ?? null,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Unable to save preset.')
      const saved = data.preset as CustomerPreset
      setPresets((prev) => {
        const exists = prev.some((p) => p.id === saved.id)
        return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]
      })
      setPresetNames((prev) => ({ ...prev, [itemKey]: '' }))
    } catch (err: any) {
      setPresetError(err?.message || 'Unable to save preset.')
    }
  }

  return (
    <div ref={containerRef} className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Your Cart</h1>
        <Link href="/discover" className="text-sm text-brand-400 hover:text-brand-300 underline underline-offset-4">
          Back to Discover
        </Link>
      </div>
      <div className="glass p-4 rounded-xl text-sm text-slate-300">
        Configure every part from this cart view: tweak quantities, scale, infill, colors, material, and engraving notes before sending the job to checkout.
      </div>
      <div className="glass rounded-xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>3D Preview</span>
          {selectedPreviewItem && (
            <span className="text-[10px] normal-case tracking-normal text-slate-500">
              {selectedPreviewItem.title}{selectedPreviewItem.partName ? ` · ${selectedPreviewItem.partName}` : ''}
            </span>
          )}
        </div>
        {selectedPreviewItem ? (
          selectedViewerSrc ? (
            <LazyModelViewer
              src={selectedViewerSrc}
              fallbackSrc={selectedViewerFallback || undefined}
              height={360}
              className="bg-black/40"
              colorOverrides={selectedViewerColors}
            />
          ) : (
            <div className="h-[360px] flex items-center justify-center text-sm text-slate-400 bg-slate-900/60">
              Preview unavailable for this model.
            </div>
          )
        ) : (
          <div className="h-[360px] flex items-center justify-center text-sm text-slate-400 bg-slate-900/60">
            Add a model to your cart to preview colors.
          </div>
        )}
      </div>
      {materialWarnings?.enabled && materialStatusEntries.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-100">Filament availability</p>
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Live inventory</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {materialStatusEntries.map(({ material, warning }) => {
              const statusLabel = warning.status === 'in_stock'
                ? 'In stock'
                : warning.status === 'limited'
                  ? 'Limited'
                  : 'Out of stock'
              const tone = warning.status === 'in_stock'
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                : warning.status === 'limited'
                  ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                  : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
              return (
                <div key={material} className={`rounded-lg border px-3 py-2 text-xs ${tone}`}>
                  <div className="flex items-center justify-between">
                    <span className="uppercase tracking-[0.2em]">{material}</span>
                    <span className="font-semibold">{statusLabel}</span>
                  </div>
                  {warning.status === 'limited' && (
                    <div className="mt-1">Limited stock may affect production start and delivery timing.</div>
                  )}
                  {warning.status === 'out_of_stock' && (
                    <div className="mt-1">
                      Adds ~{warning.leadTimeDays ?? 'TBD'} days to production start and delivery.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {items.length === 0 && (
        <div className="glass p-6 rounded-xl text-slate-400">
          Cart is empty. <Link className="underline" href="/discover">Discover models</Link>
        </div>
      )}
      {items.length > 0 && (
        <>
          <div className="glass rounded-xl border border-white/10 divide-y divide-white/10">
            {items.map((item) => {
              const itemKey = `${item.modelId}-${item.partId || 'whole'}`
              const isLockedProduct = Boolean(item.options.lockedConfig)
              const modelSlotCount = normalizeModelColorSlotCount(item.colorSlotCount)
              const slotLimit = isLockedProduct
                ? Math.max(1, normalizeColors(item.options.colors).length)
                : (modelSlotCount ?? Math.max(1, maxColors))
              const itemAllowedTokens = buildAllowedColorTokenSet(Array.isArray(item.allowedColors) ? item.allowedColors : null)
              const qty = Math.max(1, item.options.qty || 1)
              const unit = itemUnitPrice(item)
              const baseTotal = unit * qty
              const discountedTotal = baseTotal * discountMultiplier
              const lineSavings = Math.max(0, baseTotal - discountedTotal)
              const batchDiscountPercent = resolveBatchDiscountPercent(qty, pricingAdjustments.batchDiscountTiers)
              const locked = item.options.lockDimensions !== false
              const getAxisScale = (axis: (typeof DIMENSION_AXES)[number]) => resolveAxisScale(item.options.scale, locked ? null : item.options.dimensionOverrides, axis)
              const getAxisSize = (axis: (typeof DIMENSION_AXES)[number]) => {
                const baseValue = item.size?.[axis]
                if (typeof baseValue !== 'number' || Number.isNaN(baseValue) || baseValue <= 0) return null
                return baseValue * getAxisScale(axis)
              }
              const hasDimensions = DIMENSION_AXES.some(axis => typeof item.size?.[axis] === 'number' && !Number.isNaN(item.size?.[axis] ?? NaN))
              const uniformScale = clampScale(Math.cbrt(getVolumeScaleMultiplier(item.options.scale, item.options.dimensionOverrides)))
              const handleScaleChange = (value: number) => {
                if (isLockedProduct) return
                const nextScale = clampScale(value)
                if (!locked) {
                  const overrides = DIMENSION_AXES.reduce((acc, axis) => {
                    acc[axis] = nextScale
                    return acc
                  }, {} as Record<(typeof DIMENSION_AXES)[number], number>)
                  update(item.modelId, { scale: nextScale, dimensionOverrides: overrides }, item.partId)
                } else {
                  update(item.modelId, { scale: nextScale, dimensionOverrides: null }, item.partId)
                }
                setDimensionInputs((prev) => {
                  if (!prev[itemKey]) return prev
                  const next = { ...prev }
                  delete next[itemKey]
                  return next
                })
              }
              const handleDimensionChange = (axis: (typeof DIMENSION_AXES)[number], input: number) => {
                if (isLockedProduct) return
                const baseValue = item.size?.[axis]
                if (typeof baseValue !== 'number' || !Number.isFinite(baseValue) || baseValue <= 0) return
                if (!Number.isFinite(input) || input <= 0) return
                const nextScale = clampScale(input / baseValue)
                if (locked) {
                  update(item.modelId, { scale: nextScale, dimensionOverrides: null }, item.partId)
                  return
                }
                const overrides = { ...(item.options.dimensionOverrides || {}) }
                overrides[axis] = nextScale
                update(item.modelId, { dimensionOverrides: overrides }, item.partId)
              }
              const toggleLock = () => {
                if (isLockedProduct) return
                if (locked) {
                  const overrides = DIMENSION_AXES.reduce((acc, axis) => {
                    acc[axis] = getAxisScale(axis)
                    return acc
                  }, {} as Record<(typeof DIMENSION_AXES)[number], number>)
                  update(item.modelId, { lockDimensions: false, dimensionOverrides: overrides }, item.partId)
                } else {
                  update(item.modelId, { lockDimensions: true, scale: uniformScale, dimensionOverrides: null }, item.partId)
                }
                setDimensionInputs((prev) => {
                  if (!prev[itemKey]) return prev
                  const next = { ...prev }
                  delete next[itemKey]
                  return next
                })
              }
              const resetDimensions = () => {
                if (isLockedProduct) return
                update(item.modelId, { scale: 1, dimensionOverrides: null, lockDimensions: true }, item.partId)
                setDimensionInputs((prev) => {
                  if (!prev[itemKey]) return prev
                  const next = { ...prev }
                  delete next[itemKey]
                  return next
                })
              }

              return (
                <div key={`${item.modelId}-${item.partId || 'whole'}`} className="p-4 grid grid-cols-[80px_1fr] gap-3 items-center">
                  <div>
                    {item.thumbnail ? (
                      <img src={item.thumbnail} className="w-20 h-14 object-cover rounded border border-white/10" alt="" />
                    ) : (
                      <div className="w-20 h-14 bg-slate-800/60 rounded border border-white/10" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/models/${item.modelId}${typeof item.partIndex === 'number' ? `?part=${item.partIndex}` : ''}`} className="font-medium hover:underline">
                        {item.title}
                      </Link>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={`text-xs ${selectedPreviewItem?.modelId === item.modelId && (selectedPreviewItem?.partId ?? null) === (item.partId ?? null) ? 'text-emerald-300' : 'text-slate-400 hover:text-white'}`}
                          onClick={() => setSelectedPreviewKey({ modelId: item.modelId, partId: item.partId ?? null })}
                        >
                          {selectedPreviewItem?.modelId === item.modelId && (selectedPreviewItem?.partId ?? null) === (item.partId ?? null)
                            ? 'Previewing'
                            : 'Preview'}
                        </button>
                        <button className="text-xs text-slate-400 hover:text-white" onClick={() => remove(item.modelId, item.partId)}>
                          Remove
                        </button>
                      </div>
                    </div>
                    {item.partName && (
                      <div className="text-xs text-slate-400">Part: {item.partName}</div>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button className="px-2 py-1 rounded-md border border-white/10" onClick={() => dec(item.modelId, item.partId)}>-</button>
                        <span>{item.options.qty}</span>
                        <button className="px-2 py-1 rounded-md border border-white/10" onClick={() => inc(item.modelId, item.partId)}>+</button>
                      </div>
                      <label className="flex items-center gap-2">
                        <span>Scale</span>
                        <input
                          className="w-20 input"
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="5"
                          value={uniformScale.toFixed(2)}
                          disabled={isLockedProduct}
                          onChange={(e) => handleScaleChange(Number(e.target.value))}
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Infill %</span>
                        <input
                          className="w-20 input"
                          type="number"
                          step="5"
                          min="0"
                          max="100"
                          value={item.options.infillPct ?? 20}
                          disabled={isLockedProduct}
                          onChange={(e) => update(item.modelId, { infillPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }, item.partId)}
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Material</span>
                        <select
                          className="w-32 input"
                          value={normalizeMaterialName(item.options.material)}
                          disabled={isLockedProduct}
                          onChange={(e) => update(item.modelId, { material: e.target.value as MaterialType }, item.partId)}
                        >
                          {(() => {
                            const normalized = normalizeMaterialName(item.options.material)
                            const options = materialOptions.slice()
                            if (!options.includes(normalized)) options.push(normalized)
                            return options
                          })().map((material) => (
                              <option key={material} value={material}>{material}</option>
                            ))}
                        </select>
                      </label>
                      <div className="flex flex-col gap-1 text-xs text-slate-400 w-full">
                        <span>{isLockedProduct ? 'AMS slots (locked)' : 'AMS slots (tap a bay to edit)'}</span>
                        <div className="space-y-1">
                          {Array.from({
                            length: Math.max(1, Math.ceil(slotLimit / 4)),
                          }).map((_, unitIdx) => {
                            const safeSlots = slotLimit
                            const baseIndex = unitIdx * 4
                            const slotsInUnit = Math.min(4, Math.max(0, safeSlots - baseIndex))
                            return (
                              <div key={`${item.modelId}-${item.partId || 'whole'}-ams-${unitIdx}`} className="rounded-lg border border-white/10 bg-slate-900/40 px-2 py-1.5">
                                <div className="flex items-center justify-between mb-0.5 text-[9px] uppercase tracking-[0.2em] text-slate-500">
                                  <span>AMS #{unitIdx + 1}</span>
                                  <span>Slots {baseIndex + 1}–{baseIndex + slotsInUnit}</span>
                                </div>
                                <div className="inline-grid grid-cols-4 gap-1 w-fit">
                                  {Array.from({ length: slotsInUnit }).map((_, slotIdx) => {
                                    const idx = baseIndex + slotIdx
                                    const slotId = `${item.modelId}-${item.partId || 'whole'}-color-${idx}`
                                    const value = item.options.colors?.[idx] || ''
                                    const swatch = resolveSwatch(value)
                                    const parsedValue = parseColorString(value)
                                    const normalizedValue = normalizeColorValue(parsedValue.name || parsedValue.hex || value)
                                    const hexValue = isHexColor(value)
                                      ? value
                                      : swatch?.hex
                                        || parsedValue.hex
                                        || paletteValueToHex.get(normalizedValue)
                                        || COLOR_PICKER_FALLBACK
                                    const isActive = activeColorSlot?.id === slotId
                                    const updateColor = (nextValue: string) => {
                                      if (isLockedProduct) return
                                      if (nextValue && !isColorAllowed(nextValue, itemAllowedTokens)) return
                                      const next = [...(item.options.colors || [])]
                                      next[idx] = nextValue
                                      update(item.modelId, { colors: applyColorRulesForItem(item, next) }, item.partId)
                                    }
                                    return (
                                      <div key={slotId} className="flex flex-col items-center gap-0.5">
                                        <div className="text-[7px] uppercase tracking-wide text-slate-400">S{idx + 1}</div>
                                        <button
                                          type="button"
                                          data-color-slot={slotId}
                                          className={`relative rounded-md border border-white/20 h-8 w-8 flex items-center justify-center transition-all ${isActive ? 'ring-2 ring-amber-400' : ''}`}
                                          style={{ background: hexValue }}
                                          disabled={isLockedProduct}
                                          onClick={(event) => {
                                            if (isLockedProduct) return
                                            if (isActive) {
                                              setActiveColorSlot(null)
                                              return
                                            }
                                            const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                                            setActiveColorAnchor({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
                                            setActiveColorSlot({
                                              id: slotId,
                                              modelId: item.modelId,
                                              partId: item.partId ?? null,
                                              index: idx,
                                            })
                                          }}
                                        >
                                          {!value && (
                                            <span className="text-[7px] uppercase tracking-wide text-white/70">
                                              Pick
                                            </span>
                                          )}
                                        </button>
                                        <div className="text-[7px] normal-case text-slate-300 truncate max-w-[54px] text-center">
                                          {value || 'No color'}
                                        </div>
                                        {value ? (
                                          <button
                                            type="button"
                                            className="px-2 py-0.5 text-[7px] uppercase rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                                            disabled={isLockedProduct}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              updateColor('')
                                            }}
                                          >
                                            Clear
                                          </button>
                                        ) : (
                                          <span className="text-[7px] uppercase rounded-full bg-black/30 text-white/70 px-2 py-0.5">
                                            Empty
                                          </span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      {!isLockedProduct && (
                        <label className="flex items-center gap-2">
                          <span>Engraving</span>
                          <input
                            className="w-40 input"
                            value={item.options.customText || ''}
                            onChange={(e) => update(item.modelId, { customText: e.target.value || null }, item.partId)}
                            placeholder="optional engraving"
                          />
                        </label>
                      )}
                      <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Saved presets</div>
                        {isLockedProduct && <div className="text-[11px] text-slate-500">Preset edits are disabled for locked product configurations.</div>}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {presets.length > 0 ? (
                            <select
                              className="input text-xs"
                              defaultValue=""
                              disabled={isLockedProduct}
                              onChange={(e) => {
                                if (isLockedProduct) return
                                const preset = presets.find((p) => p.id === e.target.value)
                                if (preset) applyPreset(preset, item)
                              }}
                            >
                              <option value="">Apply preset...</option>
                              {presets.map((preset) => (
                                <option key={preset.id} value={preset.id}>{preset.name}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="text-xs text-slate-500">
                              No presets yet.
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              className="input text-xs"
                              placeholder="Preset name"
                              value={presetNames[itemKey] || ''}
                              disabled={isLockedProduct}
                              onChange={(e) => setPresetNames((prev) => ({ ...prev, [itemKey]: e.target.value }))}
                            />
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20 text-xs"
                              disabled={isLockedProduct}
                              onClick={() => savePreset(itemKey, item)}
                            >
                              Save preset
                            </button>
                          </div>
                        </div>
                        {presetError && <div className="text-xs text-amber-300">{presetError}</div>}
                      </div>
                    </div>
                    {hasDimensions && !isLockedProduct ? (
                      <div className="space-y-1 text-xs">
                        {(() => {
                          const baseText = DIMENSION_AXES.map((axis) => {
                            const base = item.size?.[axis]
                            if (typeof base !== 'number' || Number.isNaN(base)) return null
                            return base.toFixed(0)
                          }).filter(Boolean).join(' x ')
                          const scaledText = DIMENSION_AXES.map((axis) => {
                            const scaled = getAxisSize(axis)
                            if (scaled == null) return null
                            return scaled.toFixed(0)
                          }).filter(Boolean).join(' x ')
                          return (
                            <div className="text-slate-400">
                              Size: {baseText} mm
                              {scaledText && scaledText !== baseText && (
                                <>
                                  {' '}
                                  {'\u2192'} {scaledText} mm
                                </>
                              )}
                            </div>
                          )
                        })()}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-slate-400">
                            <span>Target dimensions (mm)</span>
                            <button type="button" className="text-xs px-2 py-1 rounded border border-white/10 hover:border-white/20" onClick={toggleLock}>
                              {locked ? 'Ratio locked' : 'Ratio free'}
                            </button>
                            <button type="button" className="text-xs px-2 py-1 rounded border border-white/10 hover:border-white/20" onClick={resetDimensions}>
                              Reset
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {DIMENSION_AXES.map((axis) => {
                              const dim = getAxisSize(axis)
                              const isActive = activeDimensionInput?.key === itemKey && activeDimensionInput.axis === axis
                              const inputValue = isActive
                                ? (dimensionInputs[itemKey]?.[axis] ?? '')
                                : (dim != null ? dim.toFixed(1) : '')
                              return (
                                <label key={`${item.modelId}-${axis}`} className="flex flex-col gap-1 text-slate-400 text-xs">
                                  <span>{AXIS_LABELS[axis]}</span>
                                  <input
                                    className="w-28 input text-sm"
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={inputValue}
                                    onFocus={() => {
                                      setActiveDimensionInput({ key: itemKey, axis })
                                      setDimensionInputs((prev) => {
                                        const current = prev[itemKey]?.[axis]
                                        if (current != null) return prev
                                        const next = { ...prev }
                                        next[itemKey] = { ...(next[itemKey] || {}), [axis]: inputValue }
                                        return next
                                      })
                                    }}
                                    onBlur={() => {
                                      setActiveDimensionInput(null)
                                      setDimensionInputs((prev) => {
                                        if (!prev[itemKey]) return prev
                                        const next = { ...prev }
                                        delete next[itemKey]
                                        return next
                                      })
                                    }}
                                    onChange={(e) => {
                                      const nextValue = e.target.value
                                      setDimensionInputs((prev) => {
                                        const next = { ...prev }
                                        next[itemKey] = { ...(next[itemKey] || {}), [axis]: nextValue }
                                        return next
                                      })
                                      const parsed = Number(nextValue)
                                      if (Number.isFinite(parsed) && parsed > 0) handleDimensionChange(axis, parsed)
                                    }}
                                  />
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">
                        {isLockedProduct
                          ? 'Dimensions are locked for this configured product.'
                          : 'Size metadata missing — add model dimensions to enable dimension controls.'}
                      </div>
                    )}
                    <div className="text-xs text-emerald-300 space-y-1">
                      <div>
                        Est. item total: {formatCurrency(discountedTotal)}
                        {totalDiscountPercent > 0 && lineSavings > 0.01 && (
                          <span className="ml-2 text-emerald-200">(-{formatCurrency(lineSavings)} with discount)</span>
                        )}
                      </div>
                      {(rush || pricingAdjustments.demandSurgeMultiplier > 1 || batchDiscountPercent > 0) && (
                        <div className="text-[11px] text-slate-400">
                          {rush ? 'Rush pricing applied.' : 'Standard timing.'}{' '}
                          {pricingAdjustments.demandSurgeMultiplier > 1 ? `Demand surge x${pricingAdjustments.demandSurgeMultiplier.toFixed(2)}.` : ''}
                          {batchDiscountPercent > 0 ? ` Batch discount ${batchDiscountPercent}% included.` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <button className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20" onClick={clear}>
              Clear cart
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="mb-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-300">
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Rush production</span>
                    <input
                      type="checkbox"
                      checked={rush}
                      onChange={(e) => setRush(e.target.checked)}
                    />
                  </label>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Adds {Math.max(0, Math.round((pricingAdjustments.rushMultiplier - 1) * 100))}% to prioritize print time.
                  </div>
                </div>
                {pricingAdjustments.batchDiscountTiers.length > 0 && (
                  <div className="mb-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-slate-400">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-1">Bulk pricing tiers</div>
                    <div className="flex flex-wrap gap-2">
                      {pricingAdjustments.batchDiscountTiers.map((tier) => (
                        <span key={`tier-${tier.minQty}-${tier.percent}`} className="rounded-full border border-white/10 px-2 py-0.5">
                          {tier.minQty}+ {'\u2192'} {tier.percent}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-slate-400 text-sm">Estimated subtotal</div>
                {totalDiscountPercent > 0 && (
                  <>
                    <div className="text-xs line-through text-slate-500">{formatCurrency(subtotal)}</div>
                    <div className="text-xs text-emerald-300">
                      Discount ({totalDiscountPercent}%): -{formatCurrency(discountSavings)}
                    </div>
                  </>
                )}
                <div className="text-lg font-semibold">
                  {formatCurrency(totalDiscountPercent > 0 ? discountedSubtotal : subtotal)}
                </div>
                {discount && discount.totalPercent > 0 && (
                  <div className="text-xs text-emerald-200">
                    {discount.isFriendsAndFamily ? 'Friends & Family discount' : 'Discount'} applied
                  </div>
                )}
              </div>
              {disableCheckout ? (
                <button type="button" className="btn whitespace-nowrap opacity-60 cursor-not-allowed" disabled>
                  Checkout
                </button>
              ) : (
                <Link href="/checkout" className="btn whitespace-nowrap">
                  Checkout
                </Link>
              )}
            </div>
          </div>
          {disableCheckout && (
            <div className="space-y-2 mt-3 text-xs text-amber-300">
              {hasMissingColors && (
                <p>Choose at least one filament color for each item before checking out.</p>
              )}
              {!meetsMinimumOrder && minimumOrderSubtotal && (
                <p>
                  Minimum order subtotal is {formatCurrency(minimumOrderSubtotal)}.
                  {minimumOrder.notes ? ` ${minimumOrder.notes}` : ''}
                </p>
              )}
            </div>
          )}
        </>
      )}
      {activeColorSlot && activeSlotItem && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" />
          <div
            ref={paletteRef}
            className={`absolute bg-slate-950/95 text-white rounded-xl border border-white/10 shadow-2xl p-3 w-[320px] max-w-[calc(100vw-2rem)] flex flex-col ${
              isMobilePalette ? 'left-1/2 bottom-6 -translate-x-1/2' : ''
            }`}
            style={isMobilePalette || !activeColorAnchor ? undefined : {
              left: Math.max(
                PALETTE_MARGIN,
                Math.min(containerRef.current?.getBoundingClientRect().left ?? activeColorAnchor.left, window.innerWidth - (paletteWidth || 340) - PALETTE_MARGIN),
              ),
              top: palettePlacement === 'above'
                ? Math.max(PALETTE_MARGIN, activeColorAnchor.top - 12 - (paletteMaxHeight || 0))
                : Math.max(activeColorAnchor.top + activeColorAnchor.height + 12, PALETTE_MARGIN),
              width: paletteWidth || undefined,
              maxHeight: paletteMaxHeight || undefined,
            }}
          >
            <div className="flex items-center justify-between mb-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
              <span>Slot {activeColorSlot.index + 1}</span>
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
            <div className="rounded-lg border border-white/10 bg-slate-900/70 p-2 flex-1 overflow-y-auto min-h-[160px]">
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
                                style={{ background: swatchOption.hex }}
                                aria-label={`Select ${swatchOption.name}`}
                                onClick={() => {
                                  if (activeSlotLocked) return
                                  if (!isColorAllowed(`${swatchOption.name} ${swatchOption.hex}`, activeSlotAllowedTokens)) return
                                  const next = [...(activeSlotItem.options.colors || [])]
                                  const nextValue = swatchOption.name && swatchOption.hex
                                    ? `${swatchOption.name} ${swatchOption.hex}`
                                    : swatchOption.name || swatchOption.hex
                                  next[activeColorSlot.index] = nextValue
                                  update(activeColorSlot.modelId, { colors: applyColorRulesForItem(activeSlotItem, next) }, activeColorSlot.partId)
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
                        {(() => {
                          const blendHexes = (activeSlotItem?.options.colors || []).map(resolveColorHex).filter(Boolean)
                          if (blendHexes.length < 2) return null
                          const blendGradient = buildBlendGradient(blendHexes)
                          const blendPairs = blendHexes.slice(0, -1).map((hex, idx) => ({
                            from: hex,
                            to: blendHexes[idx + 1],
                            mixed: mixHex(hex, blendHexes[idx + 1]),
                            label: `S${idx + 1}→S${idx + 2}`,
                          }))
                          return (
                            <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-2 space-y-2">
                              <div className="text-[9px] uppercase tracking-[0.25em] text-slate-500">AMS blend preview</div>
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
                          )
                        })()}
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
                disabled={activeSlotLocked}
                onChange={(e) => {
                  if (activeSlotLocked) return
                  if (e.target.value && !isColorAllowed(e.target.value, activeSlotAllowedTokens)) return
                  const next = [...(activeSlotItem.options.colors || [])]
                  next[activeColorSlot.index] = e.target.value
                  update(activeColorSlot.modelId, { colors: applyColorRulesForItem(activeSlotItem, next) }, activeColorSlot.partId)
                }}
              />
              <label className="text-[10px] uppercase tracking-wide text-slate-400">
                Custom colour
                <input
                  type="color"
                  className="mt-1 h-10 w-full rounded-md border border-white/20 bg-transparent cursor-pointer"
                  value={activeSlotHexValue}
                  disabled={activeSlotLocked}
                  aria-label={`Pick colour ${activeColorSlot.index + 1}`}
                  onChange={(e) => {
                    if (activeSlotLocked) return
                    if (!isColorAllowed(e.target.value, activeSlotAllowedTokens)) return
                    const next = [...(activeSlotItem.options.colors || [])]
                    next[activeColorSlot.index] = e.target.value
                    update(activeColorSlot.modelId, { colors: applyColorRulesForItem(activeSlotItem, next) }, activeColorSlot.partId)
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
