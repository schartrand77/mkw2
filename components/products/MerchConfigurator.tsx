"use client"

import { useMemo, useState } from 'react'
import MerchNotifyForm from '@/components/products/MerchNotifyForm'
import { formatCurrency } from '@/lib/currency'

type MerchItem = {
  id: string
  title: string
  category?: string | null
  availability: string
  priceUsd?: number | null
  externalUrl?: string | null
  ctaLabel?: string | null
  sizeOptions?: string[] | null
  colorOptions?: string[] | null
}

type Props = {
  item: MerchItem
}

const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']
const APPAREL_COLORS = ['Black', 'White', 'Heather Gray', 'Navy', 'Red']
const DEFAULT_COLORS = ['Black', 'White', 'Gray']

function isApparel(item: MerchItem) {
  const text = `${item.title} ${item.category || ''}`.toLowerCase()
  return ['shirt', 'tee', 'hoodie', 'sweatshirt', 'clothing', 'apparel', 'jacket', 'hat'].some((token) => text.includes(token))
}

export default function MerchConfigurator({ item }: Props) {
  const apparel = isApparel(item)
  const sizes = useMemo(() => {
    if (Array.isArray(item.sizeOptions) && item.sizeOptions.length > 0) return item.sizeOptions
    return apparel ? APPAREL_SIZES : ['One Size']
  }, [item.sizeOptions, apparel])
  const colors = useMemo(() => {
    if (Array.isArray(item.colorOptions) && item.colorOptions.length > 0) return item.colorOptions
    return apparel ? APPAREL_COLORS : DEFAULT_COLORS
  }, [item.colorOptions, apparel])

  const [size, setSize] = useState(sizes[0])
  const [color, setColor] = useState(colors[0])
  const [qty, setQty] = useState(1)

  const configuredCtaLabel = useMemo(
    () => `${item.ctaLabel || 'View item'} (${size}, ${color}, qty ${qty})`,
    [color, item.ctaLabel, qty, size],
  )

  return (
    <div data-panel="PurchasePanel" className="rounded-xl border border-white/10 bg-slate-950/90 p-5 shadow-2xl shadow-black/30 space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className={`rounded-full px-3 py-1 font-medium ${item.availability === 'back_ordered' ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
            {item.availability === 'back_ordered' ? 'Back ordered' : 'In stock'}
          </span>
          <span className="text-slate-400">{item.category || 'Merch'}</span>
        </div>
        <div>
          <h2 className="text-2xl font-semibold leading-tight">{item.title}</h2>
          <div className="mt-2 text-2xl font-semibold text-white">
            {item.priceUsd != null ? formatCurrency(item.priceUsd) : 'Price on request'}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {apparel && (
          <label className="text-sm space-y-1">
            <span className="text-slate-400">Size</span>
            <select className="input" value={size} onChange={(e) => setSize(e.target.value)}>
              {sizes.map((entry) => (
                <option key={entry} value={entry}>{entry}</option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm space-y-1">
          <span className="text-slate-400">Color</span>
          <select className="input" value={color} onChange={(e) => setColor(e.target.value)}>
            {colors.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
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
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-slate-500">Color</div>
          <div className="mt-1 font-medium text-slate-100">{color}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-slate-500">Quantity</div>
          <div className="mt-1 font-medium text-slate-100">{qty}</div>
        </div>
        {apparel && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-slate-500">Size</div>
            <div className="mt-1 font-medium text-slate-100">{size}</div>
          </div>
        )}
      </div>
      {item.availability === 'back_ordered' ? (
        <MerchNotifyForm merchItemId={item.id} title={item.title} />
      ) : item.externalUrl ? (
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn w-full justify-center py-3 text-base"
        >
          {configuredCtaLabel}
        </a>
      ) : (
        <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
          Contact us to place this configuration.
        </div>
      )}
    </div>
  )
}
