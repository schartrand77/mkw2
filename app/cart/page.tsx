"use client"
import { useCart } from '@/components/cart/CartProvider'
import Link from 'next/link'
import { formatCurrency } from '@/lib/currency'
import { getColorMultiplier, getMaterialMultiplier, MAX_CART_COLORS, type MaterialType } from '@/lib/cartPricing'

export default function CartPage() {
  const { items, inc, dec, update, remove, clear } = useCart()
  const itemUnitPrice = (it: (typeof items)[number]) => {
    const base = it.priceUsd || 0
    const scale = it.options.scale || 1
    const materialMultiplier = getMaterialMultiplier(it.options.material)
    const colorMultiplier = getColorMultiplier(it.options.colors)
    return base * Math.pow(scale, 3) * materialMultiplier * colorMultiplier
  }
  const subtotal = items.reduce((sum, it) => sum + itemUnitPrice(it) * (it.options.qty || 0), 0)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Your Cart</h1>
        <Link href="/discover" className="text-sm text-brand-400 hover:text-brand-300 underline underline-offset-4">Back to Discover</Link>
      </div>
      {items.length === 0 && (
        <div className="glass p-6 rounded-xl text-slate-400">Cart is empty. <Link className="underline" href="/discover">Discover models</Link></div>
      )}
      {items.length > 0 && (
        <>
          <div className="glass rounded-xl border border-white/10 divide-y divide-white/10">
            {items.map((it) => (
              <div key={it.modelId} className="p-4 grid grid-cols-[80px_1fr] gap-3 items-center">
                <div>
                  {it.thumbnail ? (
                    <img src={it.thumbnail} className="w-20 h-14 object-cover rounded border border-white/10" />
                  ) : (
                    <div className="w-20 h-14 bg-slate-800/60 rounded border border-white/10" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Link href={`/models/${it.modelId}`} className="font-medium hover:underline">{it.title}</Link>
                    <button className="text-xs text-slate-400 hover:text-white" onClick={() => remove(it.modelId)}>Remove</button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 rounded-md border border-white/10" onClick={() => dec(it.modelId)}>-</button>
                      <span>{it.options.qty}</span>
                      <button className="px-2 py-1 rounded-md border border-white/10" onClick={() => inc(it.modelId)}>+</button>
                    </div>
                    <label className="flex items-center gap-2">Scale
                      <input className="w-20 input" type="number" step="0.1" min="0.1" max="5" value={it.options.scale}
                        onChange={(e) => update(it.modelId, { scale: Math.max(0.1, Math.min(5, Number(e.target.value) || 1)) })} />
                    </label>
                    <label className="flex items-center gap-2">Infill %
                      <input className="w-20 input" type="number" step="5" min="0" max="100" value={it.options.infillPct ?? 20}
                        onChange={(e) => update(it.modelId, { infillPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                    </label>
                    <label className="flex items-center gap-2">Material
                      <select
                        className="w-32 input"
                        value={it.options.material || 'PLA'}
                        onChange={(e) => update(it.modelId, { material: e.target.value as MaterialType })}
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
                            key={`${it.modelId}-color-${idx}`}
                            className="w-28 input text-sm"
                            value={it.options.colors?.[idx] || ''}
                            placeholder={`Color ${idx + 1}`}
                            onChange={(e) => {
                              const next = [...(it.options.colors || [])]
                              next[idx] = e.target.value
                              update(it.modelId, { colors: next })
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-2">Text
                      <input className="w-40 input" value={it.options.customText || ''}
                        onChange={(e) => update(it.modelId, { customText: e.target.value || null })} placeholder="optional engraving" />
                    </label>
                  </div>
                  <div className="text-xs text-slate-500">
                    Size: {it.size?.x && it.size?.y && it.size?.z ? `${it.size.x.toFixed(0)}Ã—${it.size.y.toFixed(0)}Ã—${it.size.z.toFixed(0)} mm` : 'â€”'}
                  </div>
                  <div className="text-xs text-emerald-300">
                    Est. item total: {formatCurrency(itemUnitPrice(it) * (it.options.qty || 0))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <button className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20" onClick={clear}>Clear cart</button>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-slate-400 text-sm">Estimated subtotal</div>
                <div className="text-lg font-semibold">{formatCurrency(subtotal)}</div>
              </div>
              <Link href="/checkout" className="btn whitespace-nowrap">Checkout</Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}