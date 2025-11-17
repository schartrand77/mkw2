"use client"
import type { CheckoutLineItem } from '@/types/checkout'
import { formatCurrency, type Currency } from '@/lib/currency'
import type { DiscountSummary } from '@/lib/discounts'

type Props = {
  items: CheckoutLineItem[]
  currency: Currency
  total: number
  discount?: DiscountSummary | null
}

export default function OrderSummary({ items, currency, total, discount }: Props) {
  const totalSavings = items.reduce((sum, item) => {
    const undiscounted = item.undiscountedLineTotal ?? item.lineTotal
    return sum + Math.max(0, undiscounted - item.lineTotal)
  }, 0)

  return (
    <div className="glass rounded-xl border border-white/10 divide-y divide-white/10">
      {items.map((item) => {
        const palette = (item.colors || []).filter(Boolean)
        const savings = item.undiscountedLineTotal ? Math.max(0, item.undiscountedLineTotal - item.lineTotal) : 0
        return (
          <div
            key={`${item.modelId}-${item.scale}-${item.material}-${palette.join('-')}-${item.customText ?? ''}-${item.infillPct ?? 'na'}`}
            className="p-4 space-y-1 text-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-slate-400">
                  {item.qty} x scale {item.scale.toFixed(2)} | {item.material}
                  {palette.length > 0 && <> | Colors: {palette.join(', ')}</>}
                  {typeof item.infillPct === 'number' ? ` | ${item.infillPct}% infill` : ''}
                </div>
              </div>
              <div className="font-medium">{formatCurrency(item.lineTotal, currency)}</div>
            </div>
            {item.customText && <div className="text-xs text-slate-500">Note: {item.customText}</div>}
            {savings > 0 && (
              <div className="text-xs text-emerald-300">
                Saved {formatCurrency(savings, currency)}
                {item.discountPercent ? ` (${item.discountPercent}% off)` : ''}
              </div>
            )}
          </div>
        )
      })}
      <div className="p-4 flex items-center justify-between font-semibold">
        <span>Total</span>
        <span>{formatCurrency(total, currency)}</span>
      </div>
      {totalSavings > 0 && (
        <div className="px-4 pb-4 text-xs text-emerald-200">
          Discount applied{discount?.isFriendsAndFamily ? ' (Friends & Family)' : ''}: -{formatCurrency(totalSavings, currency)}
        </div>
      )}
    </div>
  )
}
