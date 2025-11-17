"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/components/cart/CartProvider'
import { formatCurrency } from '@/lib/currency'
import { getColorMultiplier, getMaterialMultiplier, MAX_CART_COLORS, type MaterialType } from '@/lib/cartPricing'
import type { DiscountSummary } from '@/lib/discounts'
import { getDiscountMultiplier } from '@/lib/discounts'

export default function CartPage() {
  const { items, inc, dec, update, remove, clear } = useCart()
  const [discount, setDiscount] = useState<DiscountSummary | null>(null)

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

  const discountMultiplier = useMemo(() => getDiscountMultiplier(discount), [discount])
  const totalDiscountPercent = discount?.totalPercent ?? 0

  const itemUnitPrice = (item: (typeof items)[number]) => {
    const base = item.priceUsd || 0
    const scale = item.options.scale || 1
    const materialMultiplier = getMaterialMultiplier(item.options.material)
    const colorMultiplier = getColorMultiplier(item.options.colors)
    return base * Math.pow(scale, 3) * materialMultiplier * colorMultiplier
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

              return (
                <div key={item.modelId} className="p-4 grid grid-cols-[80px_1fr] gap-3 items-center">
                  <div>
                    {item.thumbnail ? (
                      <img src={item.thumbnail} className="w-20 h-14 object-cover rounded border border-white/10" alt="" />
                    ) : (
                      <div className="w-20 h-14 bg-slate-800/60 rounded border border-white/10" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/models/${item.modelId}`} className="font-medium hover:underline">
                        {item.title}
                      </Link>
                      <button className="text-xs text-slate-400 hover:text-white" onClick={() => remove(item.modelId)}>
                        Remove
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button className="px-2 py-1 rounded-md border border-white/10" onClick={() => dec(item.modelId)}>-</button>
                        <span>{item.options.qty}</span>
                        <button className="px-2 py-1 rounded-md border border-white/10" onClick={() => inc(item.modelId)}>+</button>
                      </div>
                      <label className="flex items-center gap-2">
                        <span>Scale</span>
                        <input
                          className="w-20 input"
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="5"
                          value={item.options.scale}
                          onChange={(e) => update(item.modelId, { scale: Math.max(0.1, Math.min(5, Number(e.target.value) || 1)) })}
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
                          onChange={(e) => update(item.modelId, { infillPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Material</span>
                        <select
                          className="w-32 input"
                          value={item.options.material || 'PLA'}
                          onChange={(e) => update(item.modelId, { material: e.target.value as MaterialType })}
                        >
                          <option value="PLA">PLA</option>
                          <option value="PETG">PETG</option>
                        </select>
                      </label>
                      <div className="flex flex-col gap-1 text-xs text-slate-400">
                        <span>Colors (up to {MAX_CART_COLORS})</span>
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: MAX_CART_COLORS }).map((_, idx) => (
                            <input
                              key={`${item.modelId}-color-${idx}`}
                              className="w-28 input text-sm"
                              value={item.options.colors?.[idx] || ''}
                              placeholder={`Color ${idx + 1}`}
                              onChange={(e) => {
                                const next = [...(item.options.colors || [])]
                                next[idx] = e.target.value
                                update(item.modelId, { colors: next })
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <label className="flex items-center gap-2">
                        <span>Text</span>
                        <input
                          className="w-40 input"
                          value={item.options.customText || ''}
                          onChange={(e) => update(item.modelId, { customText: e.target.value || null })}
                          placeholder="optional engraving"
                        />
                      </label>
                    </div>
                    <div className="text-xs text-slate-500">
                      Size:{' '}
                      {item.size?.x && item.size?.y && item.size?.z
                        ? `${item.size.x.toFixed(0)} x ${item.size.y.toFixed(0)} x ${item.size.z.toFixed(0)} mm`
                        : 'n/a'}
                    </div>
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
    </div>
  )
}
