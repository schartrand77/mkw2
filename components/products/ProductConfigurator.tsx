"use client"

import { useMemo, useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { formatCurrency } from '@/lib/currency'
import {
  clampScale,
  getColorMultiplier,
  getFinishMultiplier,
  getMaterialMultiplier,
  normalizeMaterialName,
} from '@/lib/cartPricing'

type ProductTemplate = {
  id: string
  title: string
  description?: string | null
  baseModelId?: string | null
  lockedMaterial?: string | null
  lockedColor?: string | null
  lockedColorCount?: number | null
  lockedScale?: number | null
  lockedFinish?: string | null
  lockedPriceMultiplier?: number | null
}

type BaseModel = {
  id: string
  title: string
  priceUsd?: number | null
  effectivePriceUsd?: number | null
  salePriceUsd?: number | null
  material?: string | null
  flatRatePricing?: boolean | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  coverImagePath?: string | null
  updatedAt?: string | Date | null
}

type Props = {
  product: ProductTemplate
  baseModel: BaseModel | null
  coverUrl?: string | null
}

export default function ProductConfigurator({ product, baseModel, coverUrl }: Props) {
  const { add, pricingAdjustments } = useCart()
  const [qty, setQty] = useState(1)

  const resolvedMaterial = normalizeMaterialName(product.lockedMaterial || baseModel?.material || 'PLA')
  const colorCount = Math.max(1, Math.round(product.lockedColorCount ?? 1))
  const scale = clampScale(product.lockedScale ?? 1)
  const finish = (product.lockedFinish || 'standard').trim().toLowerCase()
  const priceMultiplier = Math.max(0.1, Math.min(5, Number(product.lockedPriceMultiplier ?? 1)))
  const lockedColor = (product.lockedColor || '').trim() || 'Standard'
  const resolvedBasePrice = baseModel
    ? (baseModel.salePriceUsd ?? baseModel.effectivePriceUsd ?? baseModel.priceUsd ?? null)
    : null

  const estimatedPrice = useMemo(() => {
    const basePrice = resolvedBasePrice ?? 0
    if (!basePrice) return null
    const volumeMultiplier = Math.pow(scale, 3)
    const colorMultiplier = baseModel?.flatRatePricing ? 1 : getColorMultiplier(Array.from({ length: colorCount }, () => 'X'))
    const materialMultiplier = getMaterialMultiplier(resolvedMaterial)
    const finishMultiplier = getFinishMultiplier(finish)
    return Number((basePrice * volumeMultiplier * colorMultiplier * materialMultiplier * finishMultiplier * priceMultiplier).toFixed(2))
  }, [baseModel?.flatRatePricing, colorCount, finish, priceMultiplier, resolvedBasePrice, resolvedMaterial, scale])

  const addToCart = () => {
    if (!baseModel?.id) return
    const colors = Array.from({ length: colorCount }, () => lockedColor)
    add(
      {
        modelId: baseModel.id,
        flatRatePricing: Boolean(baseModel.flatRatePricing),
        title: product.title,
        priceUsd: resolvedBasePrice ?? null,
        thumbnail: coverUrl || null,
        colorSlotCount: colorCount,
        size: {
          x: baseModel.sizeXmm ?? undefined,
          y: baseModel.sizeYmm ?? undefined,
          z: baseModel.sizeZmm ?? undefined,
        },
      },
      {
        qty: Math.max(1, qty),
        scale,
        material: resolvedMaterial,
        colors,
        finish,
        customText: null,
        priceMultiplier,
        lockedConfig: true,
        productTemplateId: product.id,
      },
    )
  }

  if (!baseModel) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
        This product template is missing a base model. Add one in the Product Builder.
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl border border-white/10 p-6 space-y-4">
      <div className="flex items-center gap-4">
        {coverUrl ? (
          <img src={coverUrl} alt={product.title} className="w-20 h-20 rounded-lg border border-white/10 object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-lg border border-white/10 bg-slate-900/70 flex items-center justify-center text-xs text-slate-500">
            No preview
          </div>
        )}
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Configured Product</div>
          <div className="text-lg font-semibold">{product.title}</div>
          {estimatedPrice != null && (
            <div className="text-sm text-slate-300">Estimated from {formatCurrency(estimatedPrice)}</div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-300 space-y-1">
        <div>Material: {resolvedMaterial}</div>
        <div>Color: {lockedColor || 'Configured at production'}</div>
        <div>Color slots: {colorCount}</div>
        <div>Finish: {finish}</div>
        <div>Scale: {scale.toFixed(2)}x</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Quantity</span>
          <input
            className="input"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
          />
        </label>
      </div>

      {pricingAdjustments.batchDiscountTiers.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-400">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">Bulk pricing tiers</div>
          <div className="flex flex-wrap gap-2">
            {pricingAdjustments.batchDiscountTiers.map((tier) => (
              <span key={`${tier.minQty}-${tier.percent}`} className="rounded-full border border-white/10 px-2 py-0.5">
                {tier.minQty}+ {'\u2192'} {tier.percent}%
              </span>
            ))}
          </div>
        </div>
      )}

      <button type="button" className="btn w-full justify-center" onClick={addToCart}>
        Add to cart
      </button>
    </div>
  )
}
