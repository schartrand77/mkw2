"use client"
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { type MaterialType, normalizeColors } from '@/lib/cartPricing'

export type CartOptions = {
  qty: number
  scale: number // 1.0 = 100%
  material: MaterialType
  colors: string[]
  infillPct?: number | null // 0-100
  customText?: string | null
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

function sanitizeOptions(opts?: LegacyCartOptions | null): CartOptions {
  const colorsSource = Array.isArray(opts?.colors) ? opts?.colors : (opts?.color ? [opts.color] : [])
  return {
    qty: Math.max(1, Math.floor(opts?.qty ?? 1)),
    scale: opts?.scale ?? 1,
    material: opts?.material === 'PETG' ? 'PETG' : 'PLA',
    colors: normalizeColors(colorsSource),
    infillPct: typeof opts?.infillPct === 'number' ? opts.infillPct : null,
    customText: opts?.customText ?? null,
  }
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
        const merged: CartOptions = {
          ...existing.options,
          qty: existing.options.qty + (opts?.qty || 1),
        }
        if (opts?.scale != null) merged.scale = opts.scale
        if (opts?.material) merged.material = opts.material === 'PETG' ? 'PETG' : 'PLA'
        if (opts?.colors !== undefined) merged.colors = normalizeColors(opts.colors)
        if (opts?.infillPct !== undefined) merged.infillPct = opts.infillPct
        if (opts?.customText !== undefined) merged.customText = opts.customText ?? null
        next[idx] = { ...existing, options: merged }
        return next
      }
      const newItem: CartItem = {
        ...item,
        partId: normalizedPartId,
        partName: item.partName ?? null,
        partIndex: typeof item.partIndex === 'number' ? item.partIndex : null,
        options: {
          qty: opts?.qty || 1,
          scale: opts?.scale ?? 1,
          material: opts?.material === 'PETG' ? 'PETG' : 'PLA',
          colors: normalizeColors(opts?.colors),
          infillPct: opts?.infillPct ?? null,
          customText: opts?.customText ?? null,
        },
      }
      return [...prev, newItem]
    })
  }, [])

  const remove = useCallback((modelId: string, partId?: string | null) => setItems(prev => prev.filter(i => !matches(i, modelId, partId))), [])
  const inc = useCallback((modelId: string, partId?: string | null) => setItems(prev => prev.map(i => matches(i, modelId, partId) ? { ...i, options: { ...i.options, qty: i.options.qty + 1 } } : i)), [])
  const dec = useCallback((modelId: string, partId?: string | null) => setItems(prev => prev.map(i => matches(i, modelId, partId) ? { ...i, options: { ...i.options, qty: Math.max(0, i.options.qty - 1) } } : i).filter(i => i.options.qty > 0)), [])
  const update = useCallback((modelId: string, opts: Partial<CartOptions>, partId?: string | null) => setItems(prev => prev.map(i => {
    if (!matches(i, modelId, partId)) return i
    const nextOpts: CartOptions = { ...i.options, ...opts }
    if (opts.material) nextOpts.material = opts.material === 'PETG' ? 'PETG' : 'PLA'
    if (opts.colors !== undefined) nextOpts.colors = normalizeColors(opts.colors)
    return { ...i, options: nextOpts }
  })), [])
  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartCtx>(() => ({ items, count: items.reduce((a, b) => a + (b.options.qty || 0), 0), add, remove, inc, dec, update, clear }), [items, add, remove, inc, dec, update, clear])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
