import { ORDER_STATUSES } from '@/lib/orders'

const COLOR_MAP: Record<string, string> = {
  awaiting_review: 'border-amber-400/40 text-amber-200 bg-amber-500/10',
  awaiting_payment: 'border-amber-400/40 text-amber-200 bg-amber-500/10',
  in_production: 'border-sky-400/40 text-sky-200 bg-sky-500/10',
  ready: 'border-emerald-400/50 text-emerald-200 bg-emerald-500/10',
  shipped: 'border-emerald-400/50 text-emerald-200 bg-emerald-500/10',
  completed: 'border-white/20 text-slate-200 bg-white/5',
  cancelled: 'border-rose-400/40 text-rose-200 bg-rose-500/10',
}

export default function OrderStatusBadge({ status }: { status: string }) {
  const entry = ORDER_STATUSES.find((s) => s.key === status)
  const label = entry?.label ?? status
  const colorCls = COLOR_MAP[entry?.key || 'awaiting_review'] || 'border-white/20 text-slate-200 bg-white/5'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wide border ${colorCls}`}>
      {label}
    </span>
  )
}
