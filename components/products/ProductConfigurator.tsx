"use client"

import { useMemo, useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { formatCurrency } from '@/lib/currency'
import { clampScale, getColorMultiplier, getMaterialMultiplier, normalizeMaterialName } from '@/lib/cartPricing'

type OptionRow = {
  label: string
  value?: string | null
  scale?: number | null
  colorCount?: number | null
  priceMultiplier?: number | null
}

type ProductTemplate = {
  id: string
  title: string
  description?: string | null
  baseModelId?: string | null
  materialOptions?: OptionRow[] | null
  colorOptions?: OptionRow[] | null
  sizeOptions?: OptionRow[] | null
}

type BaseModel = {
  id: string
  title: string
  priceUsd?: number | null
  material?: string | null
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
  const materialOptions = (product.materialOptions || []).filter((opt) => opt.label)
  const colorOptions = (product.colorOptions || []).filter((opt) => opt.label)
  const sizeOptions = (product.sizeOptions || []).filter((opt) => opt.label)
  const [materialIndex, setMaterialIndex] = useState(0)
  const [colorIndex, setColorIndex] = useState(0)
  const [sizeIndex, setSizeIndex] = useState(0)
  const [qty, setQty] = useState(1)

  const selectedMaterial = materialOptions[materialIndex] || null
  const selectedColor = colorOptions[colorIndex] || null
  const selectedSize = sizeOptions[sizeIndex] || null

  const resolvedMaterial = normalizeMaterialName(selectedMaterial?.value || selectedMaterial?.label || baseModel?.material || 'PLA')
  const colorCount = Math.max(1, Math.round(selectedColor?.colorCount ?? 1))
  const scale = clampScale(selectedSize?.scale ?? 1)
  const optionMultiplier = (selectedMaterial?.priceMultiplier ?? 1)
    * (selectedColor?.priceMultiplier ?? 1)
    * (selectedSize?.priceMultiplier ?? 1)

  const estimatedPrice = useMemo(() => {
    const basePrice = baseModel?.priceUsd ?? 0
    if (!basePrice) return null
    const volumeMultiplier = Math.pow(scale, 3)
    const colorMultiplier = getColorMultiplier(Array.from({ length: colorCount }, () => 'X'))
    const materialMultiplier = getMaterialMultiplier(resolvedMaterial)
    const multiplier = optionMultiplier || 1
    return Number((basePrice * volumeMultiplier * colorMultiplier * materialMultiplier * multiplier).toFixed(2))
  }, [baseModel?.priceUsd, scale, colorCount, resolvedMaterial, optionMultiplier])

  const addToCart = () => {
    if (!baseModel?.id) return
    const colors = Array.from({ length: colorCount }, (_, idx) => {
      if (idx > 0) return ''
      return (selectedColor?.value || selectedColor?.label || '').trim()
    })
    add(
      {
        modelId: baseModel.id,
        title: product.title,
        priceUsd: baseModel.priceUsd ?? null,
        thumbnail: coverUrl || null,
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
        priceMultiplier: optionMultiplier || 1,
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
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Configure</div>
          <div className="text-lg font-semibold">{product.title}</div>
          {estimatedPrice != null && (
            <div className="text-sm text-slate-300">Estimated from {formatCurrency(estimatedPrice)}</div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Material</span>
          <select
            className="input"
            value={materialIndex}
            onChange={(e) => setMaterialIndex(Number(e.target.value))}
          >
            {materialOptions.length === 0 && <option value={0}>{resolvedMaterial}</option>}
            {materialOptions.map((opt, idx) => (
              <option key={`${opt.label}-${idx}`} value={idx}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Color palette</span>
          <select
            className="input"
            value={colorIndex}
            onChange={(e) => setColorIndex(Number(e.target.value))}
          >
            {colorOptions.length === 0 && <option value={0}>Standard</option>}
            {colorOptions.map((opt, idx) => (
              <option key={`${opt.label}-${idx}`} value={idx}>
                {opt.label}{opt.colorCount ? ` (${opt.colorCount} colors)` : ''}
              </option>
            ))}
          </select>
          {colorCount > 1 && (
            <p className="text-xs text-slate-500">Pick {colorCount} colors in the cart.</p>
          )}
        </label>
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Size</span>
          <select
            className="input"
            value={sizeIndex}
            onChange={(e) => setSizeIndex(Number(e.target.value))}
          >
            {sizeOptions.length === 0 && <option value={0}>Standard</option>}
            {sizeOptions.map((opt, idx) => (
              <option key={`${opt.label}-${idx}`} value={idx}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
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
