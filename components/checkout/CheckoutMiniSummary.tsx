"use client"
import type { CheckoutLineItem } from '@/types/checkout'
import { formatCurrency, type Currency } from '@/lib/currency'

type Props = {
  items: CheckoutLineItem[]
  currency: Currency
  total: number
  shippingAmount?: number | null
}

export default function CheckoutMiniSummary({ items, currency, total, shippingAmount }: Props) {
  const itemCount = items.reduce((sum, item) => sum + Math.max(1, item.qty || 1), 0)
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const avgConfidence = (() => {
    const scored = items.filter((item) => typeof item.etaConfidenceScore === 'number')
    if (scored.length === 0) return null
    return scored.reduce((sum, item) => sum + Number(item.etaConfidenceScore || 0), 0) / scored.length
  })()

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Mini summary</div>
          <div className="mt-1 text-lg font-semibold">{formatCurrency(total, currency)}</div>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div>{itemCount} item{itemCount === 1 ? '' : 's'}</div>
          {avgConfidence != null ? <div>{Math.round(avgConfidence * 100)}% ETA confidence</div> : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
        <div>
          <div className="text-slate-500">Subtotal</div>
          <div className="mt-1 font-medium">{formatCurrency(subtotal, currency)}</div>
        </div>
        <div>
          <div className="text-slate-500">Shipping</div>
          <div className="mt-1 font-medium">
            {typeof shippingAmount === 'number' ? (shippingAmount > 0 ? formatCurrency(shippingAmount, currency) : 'Free') : 'Pending'}
          </div>
        </div>
      </div>
    </div>
  )
}
