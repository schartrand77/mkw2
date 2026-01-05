"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/components/cart/CartProvider'
import { formatCurrency } from '@/lib/currency'
import {
  clampScale,
  DIMENSION_AXES,
  getColorMultiplier,
  getMaterialMultiplier,
  getVolumeScaleMultiplier,
  MATERIAL_OPTIONS,
  normalizeMaterialName,
  resolveAxisScale,
  type MaterialType,
} from '@/lib/cartPricing'
import type { DiscountSummary } from '@/lib/discounts'
import { getDiscountMultiplier } from '@/lib/discounts'

const AXIS_LABELS: Record<(typeof DIMENSION_AXES)[number], string> = {
  x: 'Width (X)',
  y: 'Depth (Y)',
  z: 'Height (Z)',
}
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
}
type SwatchOption = {
  name: string
  hex: string
  inStock?: boolean
  brand?: string
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
  return brand ? `${brand}::${base}` : base
}
const toColorMeta = (value: string | StockworksColor) => {
  if (typeof value === 'string') {
    const parsed = parseColorString(value)
    return { name: parsed.name || value, hex: parsed.hex, brand: '' }
  }
  const hex = value.hex ? normalizeAlphaHex(value.hex) : extractHex(value.name)
  const name = value.name ? value.name.replace(HEX_WITH_HASH_RE, '').replace(HEX_WITH_0X_RE, '').replace(HEX_BARE_RE, '').trim() : ''
  return { name: name || value.name || hex || 'Unknown', hex, brand: value.brand || '' }
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

export default function CartPage() {
  const { items, inc, dec, update, remove, clear, maxColors } = useCart()
  const [discount, setDiscount] = useState<DiscountSummary | null>(null)
  const [activeColorSlot, setActiveColorSlot] = useState<{ id: string; modelId: string; partId: string | null; index: number } | null>(null)
  const [activeColorAnchor, setActiveColorAnchor] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [isMobilePalette, setIsMobilePalette] = useState(false)
  const [stockworksPalette, setStockworksPalette] = useState<StockworksPalette | null>(null)
  const paletteRef = useRef<HTMLDivElement | null>(null)

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
      return
    }
    const updateAnchor = () => {
      const button = document.querySelector(`[data-color-slot="${activeColorSlot.id}"]`)
      if (!button) return
      const rect = (button as HTMLElement).getBoundingClientRect()
      setActiveColorAnchor({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
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
      return COLOR_PALETTE.map((swatch) => ({ ...swatch, brand: '' }))
    }
    const inStockSet = new Set(stockworksEntry.inStock.map((color) => normalizeColorKey(color as StockworksColor | string)))
    const ordered = [...stockworksEntry.inStock, ...stockworksEntry.orderable]
    const seen = new Set<string>()
    const output: SwatchOption[] = []
    for (const color of ordered) {
      const colorMeta = toColorMeta(color as StockworksColor | string)
      const normalized = normalizeColorValue(colorMeta.name || colorMeta.hex)
      const brandNormalized = normalizeColorValue(colorMeta.brand)
      const uniqueKey = brandNormalized ? `${brandNormalized}::${normalized}` : normalized
      if (!normalized || seen.has(uniqueKey)) continue
      seen.add(uniqueKey)
      const swatch = paletteLookup.get(normalized)
      const hex = colorMeta.hex || swatch?.hex || (isHexColor(colorMeta.name) ? colorMeta.name : COLOR_PICKER_FALLBACK)
      output.push({
        name: colorMeta.name || swatch?.name || colorMeta.hex || 'Unknown',
        hex,
        inStock: inStockSet.has(uniqueKey),
        brand: colorMeta.brand || '',
      })
    }
    return output
  }, [stockworksEntry, paletteLookup])
  const paletteValueToHex = useMemo(() => {
    const map = new Map<string, string>()
    for (const swatch of paletteOptions) {
      if (swatch.name) map.set(normalizeColorValue(swatch.name), swatch.hex)
      if (swatch.hex) map.set(normalizeColorValue(swatch.hex), swatch.hex)
    }
    return map
  }, [paletteOptions])
  const fallbackBrandLabel = stockworksEntry ? 'Other' : 'Palette'
  const paletteGroups = useMemo(() => {
    const groups: { label: string; options: SwatchOption[] }[] = []
    const groupMap = new Map<string, SwatchOption[]>()
    for (const swatch of paletteOptions) {
      const label = (swatch.brand || '').trim() || fallbackBrandLabel
      const key = normalizeColorValue(label)
      let list = groupMap.get(key)
      if (!list) {
        list = []
        groupMap.set(key, list)
        groups.push({ label, options: list })
      }
      list.push(swatch)
    }
    return groups
  }, [paletteOptions, fallbackBrandLabel])
  const activeSlotHexValue = isHexColor(activeSlotValue)
    ? activeSlotValue
    : activeSlotSwatch?.hex
      || activeSlotParsed.hex
      || paletteValueToHex.get(activeSlotNormalized)
      || COLOR_PICKER_FALLBACK
  const paletteTitle = stockworksEntry ? 'Filament brands' : 'Palette'

  const discountMultiplier = useMemo(() => getDiscountMultiplier(discount), [discount])
  const totalDiscountPercent = discount?.totalPercent ?? 0

  const itemUnitPrice = (item: (typeof items)[number]) => {
    const base = item.priceUsd || 0
    const materialMultiplier = getMaterialMultiplier(item.options.material)
    const colorMultiplier = getColorMultiplier(item.options.colors)
    const volumeMultiplier = getVolumeScaleMultiplier(item.options.scale, item.options.dimensionOverrides)
    return base * volumeMultiplier * materialMultiplier * colorMultiplier
  }

  const subtotal = items.reduce((sum, item) => {
    const unit = itemUnitPrice(item)
    const qty = Math.max(1, item.options.qty || 1)
    return sum + unit * qty
  }, 0)
  const discountedSubtotal = subtotal * discountMultiplier
  const discountSavings = Math.max(0, subtotal - discountedSubtotal)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Your Cart</h1>
        <Link href="/discover" className="text-sm text-brand-400 hover:text-brand-300 underline underline-offset-4">
          Back to Discover
        </Link>
      </div>
      <div className="glass p-4 rounded-xl text-sm text-slate-300">
        Configure every part from this cart view: tweak quantities, scale, infill, colors, material, and engraving notes before sending the job to checkout.
      </div>
      {items.length === 0 && (
        <div className="glass p-6 rounded-xl text-slate-400">
          Cart is empty. <Link className="underline" href="/discover">Discover models</Link>
        </div>
      )}
      {items.length > 0 && (
        <>
          <div className="glass rounded-xl border border-white/10 divide-y divide-white/10">
            {items.map((item) => {
              const qty = Math.max(1, item.options.qty || 1)
              const baseTotal = itemUnitPrice(item) * qty
              const discountedTotal = baseTotal * discountMultiplier
              const lineSavings = Math.max(0, baseTotal - discountedTotal)
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
              }
              const handleDimensionChange = (axis: (typeof DIMENSION_AXES)[number], input: number) => {
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
                if (locked) {
                  const overrides = DIMENSION_AXES.reduce((acc, axis) => {
                    acc[axis] = getAxisScale(axis)
                    return acc
                  }, {} as Record<(typeof DIMENSION_AXES)[number], number>)
                  update(item.modelId, { lockDimensions: false, dimensionOverrides: overrides }, item.partId)
                } else {
                  update(item.modelId, { lockDimensions: true, scale: uniformScale, dimensionOverrides: null }, item.partId)
                }
              }
              const resetDimensions = () => {
                update(item.modelId, { scale: 1, dimensionOverrides: null, lockDimensions: true }, item.partId)
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
                      <button className="text-xs text-slate-400 hover:text-white" onClick={() => remove(item.modelId, item.partId)}>
                        Remove
                      </button>
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
                          onChange={(e) => update(item.modelId, { infillPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }, item.partId)}
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Material</span>
                        <select
                          className="w-32 input"
                          value={normalizeMaterialName(item.options.material)}
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
                      <div className="flex flex-col gap-2 text-xs text-slate-400 w-full">
                        <span>AMS slots (tap a bay to edit)</span>
                        <div className="space-y-2">
                          {Array.from({ length: Math.max(1, Math.ceil(Math.max(1, maxColors) / 4)) }).map((_, unitIdx) => {
                            const safeSlots = Math.max(1, maxColors)
                            const baseIndex = unitIdx * 4
                            const slotsInUnit = Math.min(4, Math.max(0, safeSlots - baseIndex))
                            return (
                              <div key={`${item.modelId}-${item.partId || 'whole'}-ams-${unitIdx}`} className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
                                <div className="flex items-center justify-between mb-2 text-[11px] uppercase tracking-[0.3em] text-slate-500">
                                  <span>AMS #{unitIdx + 1}</span>
                                  <span>Slots {baseIndex + 1}–{baseIndex + slotsInUnit}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                                      const next = [...(item.options.colors || [])]
                                      next[idx] = nextValue
                                      update(item.modelId, { colors: next }, item.partId)
                                    }
                                    return (
                                      <div key={slotId} className="flex flex-col gap-1">
                                        <div className="relative">
                                          <button
                                            type="button"
                                            data-color-slot={slotId}
                                            className={`relative rounded-xl border border-white/20 aspect-square w-full flex items-center justify-center transition-all ${isActive ? 'ring-2 ring-amber-400' : ''}`}
                                            style={{ background: hexValue }}
                                            onClick={(event) => {
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
                                              <span className="text-[10px] uppercase tracking-wide text-white/70">
                                                Pick colour
                                              </span>
                                            )}
                                          </button>
                                          <div className="pointer-events-none absolute left-1 top-1 z-10 flex flex-col px-2 py-1 rounded-xl bg-black/55 text-white uppercase tracking-wide text-[9px]">
                                            <span className="font-semibold">Slot {idx + 1}</span>
                                            <span className="text-[8px] normal-case text-white/80 truncate max-w-[70px]">
                                              {value || 'No color'}
                                            </span>
                                          </div>
                                          {value ? (
                                            <button
                                              type="button"
                                              className="absolute right-1 top-1 z-10 px-2 py-1 text-[9px] uppercase rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                updateColor('')
                                              }}
                                            >
                                              Clear
                                            </button>
                                          ) : (
                                            <span className="pointer-events-none absolute right-1 top-1 z-10 px-2 py-1 text-[9px] uppercase rounded-full bg-black/30 text-white/70">
                                              Empty
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <label className="flex items-center gap-2">
                        <span>Text</span>
                        <input
                          className="w-40 input"
                          value={item.options.customText || ''}
                          onChange={(e) => update(item.modelId, { customText: e.target.value || null }, item.partId)}
                          placeholder="optional engraving"
                        />
                      </label>
                    </div>
                    {hasDimensions ? (
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
                              return (
                                <label key={`${item.modelId}-${axis}`} className="flex flex-col gap-1 text-slate-400 text-xs">
                                  <span>{AXIS_LABELS[axis]}</span>
                                  <input
                                    className="w-28 input text-sm"
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={dim != null ? dim.toFixed(1) : ''}
                                    onChange={(e) => handleDimensionChange(axis, Number(e.target.value))}
                                  />
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">Size metadata missing — add model dimensions to enable dimension controls.</div>
                    )}
                    <div className="text-xs text-emerald-300">
                      Est. item total: {formatCurrency(discountedTotal)}
                      {totalDiscountPercent > 0 && lineSavings > 0.01 && (
                        <span className="ml-2 text-emerald-200">(-{formatCurrency(lineSavings)} with discount)</span>
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
              <Link href="/checkout" className="btn whitespace-nowrap">
                Checkout
              </Link>
            </div>
          </div>
        </>
      )}
      {activeColorSlot && activeSlotItem && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" />
          <div
            ref={paletteRef}
            className={`absolute bg-slate-950/95 text-white rounded-xl border border-white/10 shadow-2xl p-3 w-[320px] max-w-[calc(100vw-2rem)] ${
              isMobilePalette ? 'left-1/2 bottom-6 -translate-x-1/2' : ''
            }`}
            style={isMobilePalette || !activeColorAnchor ? undefined : {
              left: Math.min(activeColorAnchor.left, window.innerWidth - 340),
              top: Math.max(activeColorAnchor.top + activeColorAnchor.height + 12, 16),
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
            <div className="rounded-lg border border-white/10 bg-slate-900/70 p-2 max-h-40 overflow-y-auto">
              <div className="space-y-3">
                {paletteGroups.map((group) => (
                  <div key={group.label}>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">{group.label}</div>
                    <div className="grid grid-cols-6 gap-2">
                      {group.options.map((swatchOption) => {
                        const swatchNormalized = normalizeColorValue(swatchOption.name || swatchOption.hex)
                        const isSelected = activeSlotNormalized === swatchNormalized
                          || activeSlotNormalized === normalizeColorValue(swatchOption.hex)
                        const ringCls = isSelected
                          ? 'ring-2 ring-amber-400'
                          : swatchOption.inStock
                            ? 'ring-2 ring-emerald-400/80'
                            : ''
                        return (
                          <button
                            key={`${swatchOption.brand || 'palette'}-${swatchOption.name}-${swatchOption.hex}`}
                            type="button"
                            title={
                              swatchOption.inStock
                                ? `${swatchOption.name} (${swatchOption.hex}) - In stock`
                                : `${swatchOption.name} (${swatchOption.hex})`
                            }
                            className={`h-8 w-8 rounded-full border border-white/30 transition-transform hover:scale-105 ${ringCls}`}
                            style={{ background: swatchOption.hex }}
                            aria-label={`Select ${swatchOption.name}`}
                            onClick={() => {
                              const next = [...(activeSlotItem.options.colors || [])]
                              const nextValue = swatchOption.name && swatchOption.hex
                                ? `${swatchOption.name} ${swatchOption.hex}`
                                : swatchOption.name || swatchOption.hex
                              next[activeColorSlot.index] = nextValue
                              update(activeColorSlot.modelId, { colors: next }, activeColorSlot.partId)
                            }}
                          >
                            <span className="sr-only">{swatchOption.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <input
                className="w-full input text-sm"
                value={activeSlotValue}
                placeholder="Name or hex"
                onChange={(e) => {
                  const next = [...(activeSlotItem.options.colors || [])]
                  next[activeColorSlot.index] = e.target.value
                  update(activeColorSlot.modelId, { colors: next }, activeColorSlot.partId)
                }}
              />
              <label className="text-[10px] uppercase tracking-wide text-slate-400">
                Custom colour
                <input
                  type="color"
                  className="mt-1 h-10 w-full rounded-md border border-white/20 bg-transparent cursor-pointer"
                  value={activeSlotHexValue}
                  aria-label={`Pick colour ${activeColorSlot.index + 1}`}
                  onChange={(e) => {
                    const next = [...(activeSlotItem.options.colors || [])]
                    next[activeColorSlot.index] = e.target.value
                    update(activeColorSlot.modelId, { colors: next }, activeColorSlot.partId)
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
