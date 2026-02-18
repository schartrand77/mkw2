"use client"

import { useMemo, useState } from 'react'
import MerchNotifyForm from '@/components/products/MerchNotifyForm'

type MerchItem = {
  id: string
  title: string
  category?: string | null
  availability: string
  externalUrl?: string | null
  ctaLabel?: string | null
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
  const sizes = apparel ? APPAREL_SIZES : ['One Size']
  const colors = apparel ? APPAREL_COLORS : DEFAULT_COLORS

  const [size, setSize] = useState(sizes[0])
  const [color, setColor] = useState(colors[0])
  const [qty, setQty] = useState(1)

  const configuredCtaLabel = useMemo(
    () => `${item.ctaLabel || 'View item'} (${size}, ${color}, qty ${qty})`,
    [color, item.ctaLabel, qty, size],
  )

  return (
    <div className="glass rounded-2xl border border-white/10 p-6 space-y-4">
      <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Configure</div>
      <div className="grid gap-3 sm:grid-cols-2">
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
      <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-300">
        <div>Selected color: {color}</div>
        {apparel && <div>Selected size: {size}</div>}
        <div>Quantity: {qty}</div>
      </div>
      {item.availability === 'back_ordered' ? (
        <MerchNotifyForm merchItemId={item.id} title={item.title} />
      ) : item.externalUrl ? (
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn w-full justify-center"
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
