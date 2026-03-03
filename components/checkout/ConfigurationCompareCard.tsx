"use client"
import type { CheckoutLineItem } from '@/types/checkout'
import { formatCurrency, type Currency } from '@/lib/currency'

type Props = {
  items: CheckoutLineItem[]
  currency: Currency
}

export default function ConfigurationCompareCard({ items, currency }: Props) {
  if (items.length < 2) return null

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Compare configurations</div>
        <p className="mt-1 text-sm text-slate-300">Keep material, finish, price, and lead-time deltas visible while you edit checkout details.</p>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${item.modelId}-${item.partId || 'whole'}-${item.material}-${item.finish || 'standard'}-${item.scale}`} className="rounded-lg border border-white/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-white">{item.title}</div>
                <div className="text-xs text-slate-400">
                  {item.material}
                  {item.finish && item.finish !== 'standard' ? ` • ${item.finish}` : ''}
                  {typeof item.infillPct === 'number' ? ` • ${item.infillPct}% infill` : ''}
                  {` • scale ${item.scale.toFixed(2)}`}
                </div>
              </div>
              <div className="text-sm font-medium text-white">{formatCurrency(item.lineTotal, currency)}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-slate-300">
              <div>
                <div className="text-slate-500">Unit price</div>
                <div className="mt-1">{formatCurrency(item.unitPrice, currency)}</div>
              </div>
              <div>
                <div className="text-slate-500">Lead time</div>
                <div className="mt-1">
                  {typeof item.leadTimeHours === 'number' ? `${item.leadTimeHours.toFixed(1)} hrs` : 'Pending'}
                  {typeof item.etaConfidenceScore === 'number' ? ` • ${Math.round(item.etaConfidenceScore * 100)}%` : ''}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
