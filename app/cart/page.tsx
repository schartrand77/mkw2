"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/components/cart/CartProvider'
import { formatCurrency } from '@/lib/currency'
import {
  clampScale,
  DIMENSION_AXES,
  getColorMultiplier,
  getMaterialMultiplier,
  getVolumeScaleMultiplier,
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
const COLOR_PALETTE = ['#ffffff', '#f9fafb', '#d1d5db', '#111827', '#f87171', '#fb923c', '#facc15', '#a3e635', '#34d399', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#c084fc', '#f472b6', '#fb7185']
const isHexColor = (value?: string | null) => !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())

export default function CartPage() {
  const { items, inc, dec, update, remove, clear, maxColors } = useCart()
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
                          value={item.options.material || 'PLA'}
                          onChange={(e) => update(item.modelId, { material: e.target.value as MaterialType }, item.partId)}
                        >
                          <option value="PLA">PLA</option>
                          <option value="PETG">PETG</option>
                        </select>
                      </label>
                      <div className="flex flex-col gap-2 text-xs text-slate-400">
                        <span>Colors (up to {maxColors})</span>
                        <div className="flex flex-wrap gap-3">
                          {Array.from({ length: Math.max(1, maxColors) }).map((_, idx) => {
                            const value = item.options.colors?.[idx] || ''
                            const hexValue = isHexColor(value) ? value : COLOR_PICKER_FALLBACK
                            const updateColor = (nextValue: string) => {
                              const next = [...(item.options.colors || [])]
                              next[idx] = nextValue
                              update(item.modelId, { colors: next }, item.partId)
                            }
                            return (
                              <div key={`${item.modelId}-${item.partId || 'whole'}-color-${idx}`} className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">Color {idx + 1}</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    className="w-28 input text-sm"
                                    value={value}
                                    placeholder="Name or hex"
                                    onChange={(e) => updateColor(e.target.value)}
                                  />
                                  <input
                                    type="color"
                                    className="h-9 w-9 rounded border border-white/10 bg-transparent cursor-pointer"
                                    value={hexValue}
                                    aria-label={`Pick color ${idx + 1}`}
                                    onChange={(e) => updateColor(e.target.value)}
                                  />
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {COLOR_PALETTE.map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      className="w-5 h-5 rounded-full border border-white/20"
                                      style={{ backgroundColor: preset }}
                                      aria-label={`Set ${preset} for color ${idx + 1}`}
                                      onClick={() => updateColor(preset)}
                                    />
                                  ))}
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
    </div>
  )
}
