"use client"
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clampScale, DIMENSION_AXES, type MaterialType, normalizeColors, type ScaleOverrides } from '@/lib/cartPricing'

export type CartOptions = {
  qty: number
  scale: number // 1.0 = 100%
  material: MaterialType
  colors: string[]
  infillPct?: number | null // 0-100
  customText?: string | null
  dimensionOverrides?: ScaleOverrides | null
  lockDimensions?: boolean
}

export type CartItem = {
  modelId: string
  partId?: string | null
  partName?: string | null
  partIndex?: number | null
  title: string
  priceUsd?: number | null
  thumbnail?: string | null
  size?: { x?: number; y?: number; z?: number }
  options: CartOptions
}

type CartCtx = {
  items: CartItem[]
  count: number
  add: (item: Omit<CartItem, 'options'>, opts?: Partial<CartOptions>) => void
  remove: (modelId: string, partId?: string | null) => void
  inc: (modelId: string, partId?: string | null) => void
  dec: (modelId: string, partId?: string | null) => void
  update: (modelId: string, opts: Partial<CartOptions>, partId?: string | null) => void
  clear: () => void
}

const Ctx = createContext<CartCtx | null>(null)

const STORAGE_KEY = 'mwv2:cart'

type LegacyCartOptions = Partial<CartOptions> & { color?: string | null }

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
  const lockDimensions = opts?.lockDimensions ?? !(opts?.dimensionOverrides && Object.keys(opts.dimensionOverrides).length > 0)
  const baseScale = clampScale(opts?.scale ?? 1)
  const overrides = lockDimensions ? null : sanitizeDimensionOverrides(opts?.dimensionOverrides)
  return {
    qty: Math.max(1, Math.floor(opts?.qty ?? 1)),
    scale: baseScale,
    material: opts?.material === 'PETG' ? 'PETG' : 'PLA',
    colors: normalizeColors(colorsSource),
    infillPct: typeof opts?.infillPct === 'number' ? Math.max(0, Math.min(100, opts.infillPct)) : null,
    customText: opts?.customText ?? null,
    dimensionOverrides: overrides,
    lockDimensions,
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
    infillPct: patch.infillPct !== undefined ? patch.infillPct : base.infillPct,
    customText: patch.customText !== undefined ? patch.customText : base.customText,
    dimensionOverrides: patch.dimensionOverrides !== undefined ? patch.dimensionOverrides : base.dimensionOverrides,
    lockDimensions: patch.lockDimensions !== undefined ? patch.lockDimensions : base.lockDimensions,
  }
  return sanitizeOptions(merged)
}

function sanitizeItem(item: any): CartItem {
  return {
    modelId: String(item?.modelId ?? ''),
    partId: item?.partId ? String(item.partId) : null,
    partName: item?.partName ? String(item.partName) : null,
    partIndex: typeof item?.partIndex === 'number' ? item.partIndex : null,
    title: String(item?.title ?? ''),
    priceUsd: typeof item?.priceUsd === 'number' ? item.priceUsd : item?.priceUsd ?? null,
    thumbnail: item?.thumbnail ?? null,
    size: item?.size,
    options: sanitizeOptions(item?.options),
  }
}

function matches(item: CartItem, modelId: string, partId?: string | null) {
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

  const add: CartCtx['add'] = useCallback((item, opts) => {
    setItems(prev => {
      const normalizedPartId = item.partId ?? null
      const idx = prev.findIndex(i => matches(i, item.modelId, normalizedPartId))
      if (idx >= 0) {
        const next = [...prev]
        const existing = next[idx]
        const merged = mergeOptions(existing.options, {
          ...opts,
          qty: existing.options.qty + (opts?.qty || 1),
        })
        next[idx] = { ...existing, options: merged }
        return next
      }
      const newItem: CartItem = {
        ...item,
        partId: normalizedPartId,
        partName: item.partName ?? null,
        partIndex: typeof item.partIndex === 'number' ? item.partIndex : null,
        options: sanitizeOptions({
          ...opts,
          qty: opts?.qty || 1,
        }),
      }
      return [...prev, newItem]
    })
  }, [])

  const remove = useCallback((modelId: string, partId?: string | null) => setItems(prev => prev.filter(i => !matches(i, modelId, partId))), [])
  const inc = useCallback((modelId: string, partId?: string | null) => setItems(prev => prev.map(i => matches(i, modelId, partId) ? { ...i, options: { ...i.options, qty: i.options.qty + 1 } } : i)), [])
  const dec = useCallback((modelId: string, partId?: string | null) => setItems(prev => prev.map(i => matches(i, modelId, partId) ? { ...i, options: { ...i.options, qty: Math.max(0, i.options.qty - 1) } } : i).filter(i => i.options.qty > 0)), [])
  const update = useCallback((modelId: string, opts: Partial<CartOptions>, partId?: string | null) => setItems(prev => prev.map(i => {
    if (!matches(i, modelId, partId)) return i
    return { ...i, options: mergeOptions(i.options, opts) }
  })), [])
  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartCtx>(() => ({ items, count: items.reduce((a, b) => a + (b.options.qty || 0), 0), add, remove, inc, dec, update, clear }), [items, add, remove, inc, dec, update, clear])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
