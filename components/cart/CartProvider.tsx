"use client"
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  clampScale,
  DIMENSION_AXES,
  type MaterialType,
  normalizeMaterialName,
  normalizeColors,
  setClientColorSurchargeRate,
  setClientFinishSurcharges,
  setClientMaterialPrices,
  setClientMaxCartColors,
  type ScaleOverrides,
  MAX_CART_COLORS,
} from '@/lib/cartPricing'
import {
  buildAllowedColorTokenSet,
  isColorAllowed,
  normalizeModelColorSlotCount,
  sanitizeAllowedColors,
} from '@/lib/color-constraints'

export type CartOptions = {
  qty: number
  scale: number // 1.0 = 100%
  material: MaterialType
  colors: string[]
  toleranceClass?: 'draft' | 'standard' | 'cosmetic' | 'fit_critical' | null
  finish?: string | null
  lockedConfig?: boolean
  productTemplateId?: string | null
  infillPct?: number | null // 0-100
  customText?: string | null
  dimensionOverrides?: ScaleOverrides | null
  lockDimensions?: boolean
  priceMultiplier?: number | null
}

export type PricingAdjustments = {
  demandSurgeMultiplier: number
  rushMultiplier: number
  batchDiscountTiers: Array<{ minQty: number; percent: number }>
}

export type MinimumOrderRule = {
  subtotal: number | null
  notes: string | null
}

export type CartItem = {
  cartItemId: string
  modelId: string
  partId?: string | null
  partName?: string | null
  partIndex?: number | null
  flatRatePricing?: boolean | null
  title: string
  priceUsd?: number | null
  thumbnail?: string | null
  size?: { x?: number; y?: number; z?: number }
  colorSlotCount?: number | null
  allowedColors?: string[] | null
  options: CartOptions
}

type CartCtx = {
  items: CartItem[]
  count: number
  maxColors: number
  pricingAdjustments: PricingAdjustments
  minimumOrder: MinimumOrderRule
  add: (item: Omit<CartItem, 'options' | 'cartItemId'>, opts?: Partial<CartOptions>) => void
  remove: (modelId: string, partId?: string | null, cartItemId?: string | null) => void
  inc: (modelId: string, partId?: string | null, cartItemId?: string | null) => void
  dec: (modelId: string, partId?: string | null, cartItemId?: string | null) => void
  update: (modelId: string, opts: Partial<CartOptions>, partId?: string | null, cartItemId?: string | null) => void
  clear: () => void
}

const Ctx = createContext<CartCtx | null>(null)

const STORAGE_KEY = 'mwv2:cart'

type LegacyCartOptions = Partial<CartOptions> & { color?: string | null }

function createCartItemId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function sanitizeDimensionOverrides(overrides?: ScaleOverrides | null): ScaleOverrides | null {
  if (!overrides) return null
  const cleaned: ScaleOverrides = {}
  for (const axis of DIMENSION_AXES) {
    const value = overrides[axis]
    if (value == null || Number.isNaN(Number(value))) continue
    cleaned[axis] = clampScale(value)
  }
  return Object.keys(cleaned).length ? cleaned : null
}

function sanitizeOptions(opts?: LegacyCartOptions | null): CartOptions {
  const colorsSource = Array.isArray(opts?.colors) ? opts?.colors : (opts?.color ? [opts.color] : [])
  const lockedConfig = Boolean(opts?.lockedConfig)
  const lockDimensions = opts?.lockDimensions ?? !(opts?.dimensionOverrides && Object.keys(opts.dimensionOverrides).length > 0)
  const baseScale = clampScale(opts?.scale ?? 1)
  const overrides = lockDimensions ? null : sanitizeDimensionOverrides(opts?.dimensionOverrides)
  const multiplier = typeof opts?.priceMultiplier === 'number'
    ? Number(opts.priceMultiplier)
    : null
  return {
    qty: Math.max(1, Math.floor(opts?.qty ?? 1)),
    scale: baseScale,
    material: normalizeMaterialName(opts?.material),
    colors: normalizeColors(colorsSource),
    toleranceClass: typeof opts?.toleranceClass === 'string' ? opts.toleranceClass as CartOptions['toleranceClass'] : 'standard',
    finish: typeof opts?.finish === 'string' ? opts.finish : null,
    lockedConfig,
    productTemplateId: typeof opts?.productTemplateId === 'string' ? opts.productTemplateId : null,
    infillPct: typeof opts?.infillPct === 'number' ? Math.max(0, Math.min(100, opts.infillPct)) : null,
    customText: lockedConfig ? null : (opts?.customText ?? null),
    dimensionOverrides: overrides,
    lockDimensions,
    priceMultiplier: multiplier != null && Number.isFinite(multiplier) ? Math.max(0.1, Math.min(5, multiplier)) : null,
  }
}

function mergeOptions(base: CartOptions, patch?: Partial<CartOptions>): CartOptions {
  if (!patch) return base
  const merged: LegacyCartOptions = {
    ...base,
    qty: patch.qty != null ? patch.qty : base.qty,
    scale: patch.scale != null ? patch.scale : base.scale,
    material: patch.material ?? base.material,
    colors: patch.colors !== undefined ? patch.colors : base.colors,
    toleranceClass: patch.toleranceClass !== undefined ? patch.toleranceClass : base.toleranceClass,
    finish: patch.finish !== undefined ? patch.finish : base.finish,
    lockedConfig: patch.lockedConfig !== undefined ? patch.lockedConfig : base.lockedConfig,
    productTemplateId: patch.productTemplateId !== undefined ? patch.productTemplateId : base.productTemplateId,
    infillPct: patch.infillPct !== undefined ? patch.infillPct : base.infillPct,
    customText: patch.customText !== undefined ? patch.customText : base.customText,
    dimensionOverrides: patch.dimensionOverrides !== undefined ? patch.dimensionOverrides : base.dimensionOverrides,
    lockDimensions: patch.lockDimensions !== undefined ? patch.lockDimensions : base.lockDimensions,
    priceMultiplier: patch.priceMultiplier !== undefined ? patch.priceMultiplier : base.priceMultiplier,
  }
  return sanitizeOptions(merged)
}

function optionsMergeKey(opts: CartOptions): string {
  const scopedScale = Number(opts.scale.toFixed(4))
  const overrides = opts.dimensionOverrides
    ? DIMENSION_AXES.map((axis) => {
      const value = opts.dimensionOverrides?.[axis]
      return value == null ? '' : Number(value).toFixed(4)
    }).join(':')
    : ''
  return JSON.stringify({
    scale: scopedScale,
    material: normalizeMaterialName(opts.material),
    colors: normalizeColors(opts.colors),
    toleranceClass: opts.toleranceClass ?? 'standard',
    finish: opts.finish ?? null,
    lockedConfig: Boolean(opts.lockedConfig),
    productTemplateId: opts.productTemplateId ?? null,
    infillPct: opts.infillPct ?? null,
    lockDimensions: opts.lockDimensions !== false,
    dimensionOverrides: overrides,
    priceMultiplier: opts.priceMultiplier == null ? null : Number(opts.priceMultiplier.toFixed(4)),
  })
}

function sanitizeItem(item: any): CartItem {
  const colorSlotCount = normalizeModelColorSlotCount(item?.colorSlotCount)
  const allowedColors = sanitizeAllowedColors(item?.allowedColors)
  const allowedTokens = buildAllowedColorTokenSet(allowedColors)
  const rawOptions = sanitizeOptions(item?.options)
  const constrainedColors = normalizeColors(rawOptions.colors, colorSlotCount ?? undefined)
    .filter((color) => isColorAllowed(color, allowedTokens))
  return {
    cartItemId: typeof item?.cartItemId === 'string' && item.cartItemId.trim()
      ? item.cartItemId.trim()
      : createCartItemId(),
    modelId: String(item?.modelId ?? ''),
    partId: item?.partId ? String(item.partId) : null,
    partName: item?.partName ? String(item.partName) : null,
    partIndex: typeof item?.partIndex === 'number' ? item.partIndex : null,
    flatRatePricing: typeof item?.flatRatePricing === 'boolean' ? item.flatRatePricing : false,
    title: String(item?.title ?? ''),
    priceUsd: typeof item?.priceUsd === 'number' ? item.priceUsd : item?.priceUsd ?? null,
    thumbnail: item?.thumbnail ?? null,
    size: item?.size,
    colorSlotCount,
    allowedColors,
    options: {
      ...rawOptions,
      colors: constrainedColors,
    },
  }
}

function matches(item: CartItem, modelId: string, partId?: string | null, cartItemId?: string | null) {
  if (typeof cartItemId === 'string' && cartItemId.trim()) {
    return item.cartItemId === cartItemId
  }
  const normalized = partId ?? null
  return item.modelId === modelId && (item.partId ?? null) === normalized
}

export function useCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [maxColors, setMaxColors] = useState<number>(MAX_CART_COLORS)
  const [pricingAdjustments, setPricingAdjustments] = useState<PricingAdjustments>({
    demandSurgeMultiplier: 1,
    rushMultiplier: 1,
    batchDiscountTiers: [],
  })
  const [minimumOrder, setMinimumOrder] = useState<MinimumOrderRule>({
    subtotal: null,
    notes: null,
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setItems(parsed.map(sanitizeItem))
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
  }, [items])

  useEffect(() => {
    let cancelled = false
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/public-config', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json().catch(() => null) as {
          maxCartColors?: number
          materialPrices?: Record<string, number>
          colorSurchargeRate?: number
          finishSurcharges?: Record<string, number>
          demandSurgeMultiplier?: number
          rushMultiplier?: number
          batchDiscountTiers?: Array<{ minQty: number; percent: number }>
          minimumOrderSubtotalUsd?: number | null
          minimumOrderNotes?: string | null
        } | null
        if (!data || cancelled) return
        const parsed = Number(data.maxCartColors)
        if (Number.isFinite(parsed) && parsed > 0) {
          const clamped = Math.max(1, Math.min(16, Math.round(parsed)))
          setMaxColors(clamped)
          setClientMaxCartColors(clamped)
        }
        if (data.materialPrices) {
          setClientMaterialPrices(data.materialPrices)
        }
        if (data.colorSurchargeRate != null) {
          setClientColorSurchargeRate(data.colorSurchargeRate)
        }
        if (data.finishSurcharges) {
          setClientFinishSurcharges(data.finishSurcharges)
        }
        setPricingAdjustments({
          demandSurgeMultiplier: typeof data.demandSurgeMultiplier === 'number' ? data.demandSurgeMultiplier : 1,
          rushMultiplier: typeof data.rushMultiplier === 'number' ? data.rushMultiplier : 1,
          batchDiscountTiers: Array.isArray(data.batchDiscountTiers) ? data.batchDiscountTiers : [],
        })
        setMinimumOrder({
          subtotal: typeof data.minimumOrderSubtotalUsd === 'number' && Number.isFinite(data.minimumOrderSubtotalUsd)
            ? data.minimumOrderSubtotalUsd
            : null,
          notes: typeof data.minimumOrderNotes === 'string' ? data.minimumOrderNotes : null,
        })
      } catch {}
    }
    loadConfig()
    return () => { cancelled = true }
  }, [])

  const add: CartCtx['add'] = useCallback((item, opts) => {
    setItems(prev => {
      const normalizedPartId = item.partId ?? null
      const incomingOptions = sanitizeOptions({
        ...opts,
        qty: opts?.qty || 1,
      })
      const incomingMergeKey = optionsMergeKey(incomingOptions)
      const idx = prev.findIndex((existing) => {
        if (!matches(existing, item.modelId, normalizedPartId)) return false
        if (!incomingOptions.lockedConfig && !existing.options.lockedConfig) return true
        return optionsMergeKey(existing.options) === incomingMergeKey
      })
      if (idx >= 0) {
        const next = [...prev]
        const existing = next[idx]
        const merged = mergeOptions(existing.options, {
          ...opts,
          qty: existing.options.qty + (opts?.qty || 1),
        })
        next[idx] = sanitizeItem({ ...existing, options: merged })
        return next
      }
      const newItem: CartItem = {
        ...item,
        cartItemId: createCartItemId(),
        partId: normalizedPartId,
        partName: item.partName ?? null,
        partIndex: typeof item.partIndex === 'number' ? item.partIndex : null,
        options: incomingOptions,
      }
      return [...prev, sanitizeItem(newItem)]
    })
  }, [])

  const remove = useCallback((modelId: string, partId?: string | null, cartItemId?: string | null) => setItems(prev => prev.filter(i => !matches(i, modelId, partId, cartItemId))), [])
  const inc = useCallback((modelId: string, partId?: string | null, cartItemId?: string | null) => setItems(prev => prev.map(i => matches(i, modelId, partId, cartItemId) ? { ...i, options: { ...i.options, qty: i.options.qty + 1 } } : i)), [])
  const dec = useCallback((modelId: string, partId?: string | null, cartItemId?: string | null) => setItems(prev => prev.map(i => matches(i, modelId, partId, cartItemId) ? { ...i, options: { ...i.options, qty: Math.max(0, i.options.qty - 1) } } : i).filter(i => i.options.qty > 0)), [])
  const update = useCallback((modelId: string, opts: Partial<CartOptions>, partId?: string | null, cartItemId?: string | null) => setItems(prev => prev.map(i => {
    if (!matches(i, modelId, partId, cartItemId)) return i
    return sanitizeItem({ ...i, options: mergeOptions(i.options, opts) })
  })), [])
  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartCtx>(() => ({
    items,
    count: items.reduce((a, b) => a + (b.options.qty || 0), 0),
    maxColors,
    pricingAdjustments,
    minimumOrder,
    add,
    remove,
    inc,
    dec,
    update,
    clear,
  }), [items, maxColors, pricingAdjustments, minimumOrder, add, remove, inc, dec, update, clear])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
