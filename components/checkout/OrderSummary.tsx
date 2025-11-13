"use client"
import type { CheckoutLineItem } from '@/types/checkout'
import { formatCurrency, type Currency } from '@/lib/currency'

type Props = {
  items: CheckoutLineItem[]
  currency: Currency
  total: number
}

export default function OrderSummary({ items, currency, total }: Props) {
  return (
    <div className="glass rounded-xl border border-white/10 divide-y divide-white/10">
      {items.map((item) => {
        const palette = (item.colors || []).filter(Boolean)
        return (
          <div
            key={`${item.modelId}-${item.scale}-${item.material}-${palette.join('-')}-${item.customText ?? ''}-${item.infillPct ?? 'na'}`}
            className="p-4 space-y-1 text-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-slate-400">
                  {item.qty} · scale {item.scale.toFixed(2)}
                  · {item.material}
                  {palette.length > 0 && <> · Colors: {palette.join(', ')}</>}
                  {typeof item.infillPct === 'number' ? ` · ${item.infillPct}% infill` : ''}
                </div>
              </div>
              <div className="font-medium">{formatCurrency(item.lineTotal, currency)}</div>
            </div>
            {item.customText && <div className="text-xs text-slate-500">Note: {item.customText}</div>}
          </div>
        )
      })}
      <div className="p-4 flex items-center justify-between font-semibold">
        <span>Total</span>
        <span>{formatCurrency(total, currency)}</span>
      </div>
    </div>
  )
}
