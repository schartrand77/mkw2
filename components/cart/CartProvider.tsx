"use client"
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type CartOptions = {
  qty: number
  scale: number // 1.0 = 100%
  color?: string | null
  infillPct?: number | null // 0-100
  customText?: string | null
}

export type CartItem = {
  modelId: string
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
  remove: (modelId: string) => void
  inc: (modelId: string) => void
  dec: (modelId: string) => void
  update: (modelId: string, opts: Partial<CartOptions>) => void
  clear: () => void
}

const Ctx = createContext<CartCtx | null>(null)

const STORAGE_KEY = 'mwv2:cart'

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
      if (raw) setItems(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
  }, [items])

  const add: CartCtx['add'] = useCallback((item, opts) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.modelId === item.modelId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], options: { ...next[idx].options, qty: next[idx].options.qty + (opts?.qty || 1) } }
        return next
      }
      const newItem: CartItem = {
        ...item,
        options: { qty: opts?.qty || 1, scale: opts?.scale ?? 1, color: opts?.color || null, infillPct: opts?.infillPct ?? null, customText: opts?.customText ?? null },
      }
      return [...prev, newItem]
    })
  }, [])

  const remove = useCallback((modelId: string) => setItems(prev => prev.filter(i => i.modelId !== modelId)), [])
  const inc = useCallback((modelId: string) => setItems(prev => prev.map(i => i.modelId === modelId ? { ...i, options: { ...i.options, qty: i.options.qty + 1 } } : i)), [])
  const dec = useCallback((modelId: string) => setItems(prev => prev.map(i => i.modelId === modelId ? { ...i, options: { ...i.options, qty: Math.max(0, i.options.qty - 1) } } : i).filter(i => i.options.qty > 0)), [])
  const update = useCallback((modelId: string, opts: Partial<CartOptions>) => setItems(prev => prev.map(i => i.modelId === modelId ? { ...i, options: { ...i.options, ...opts } } : i)), [])
  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartCtx>(() => ({ items, count: items.reduce((a, b) => a + (b.options.qty || 0), 0), add, remove, inc, dec, update, clear }), [items, add, remove, inc, dec, update, clear])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

