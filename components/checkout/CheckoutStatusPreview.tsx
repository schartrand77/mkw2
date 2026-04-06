"use client"

import { normalizeOrderStatus } from '@/lib/order-status'

type Props = {
  paymentMethodLabel: string
  shippingMethodLabel: string
  currentStatus?: string
  confirmed?: boolean
  confirmationId?: string | null
}

const DEFAULT_STEPS = [
  {
    key: 'review',
    label: 'Review configuration',
    detail: 'Confirm materials, colors, dimensions, billing, and shipping before submission.',
  },
  {
    key: 'payment',
    label: 'Payment or approval',
    detail: 'We capture payment immediately or queue invoice, PO, cash, or quote review based on your selected method.',
  },
  {
    key: 'queued',
    label: 'Queued for production',
    detail: 'Your order enters the production queue and receives printer assignment plus ETA signals.',
  },
  {
    key: 'printing',
    label: 'Printing and inspection',
    detail: 'The shop tracks execution, recovery, and post-process milestones in your order detail view.',
  },
  {
    key: 'fulfillment',
    label: 'Pickup or shipping',
    detail: 'Completed orders move to local pickup or shipment tracking based on your chosen delivery method.',
  },
]

function resolveActiveIndex(currentStatus?: string, confirmed?: boolean) {
  if (!confirmed) return 0
  const normalized = currentStatus ? normalizeOrderStatus(currentStatus) : 'queued'
  if (normalized === 'queued') return 2
  if (normalized === 'printing') return 3
  if (normalized === 'post_process' || normalized === 'shipped' || normalized === 'completed') return 4
  return 2
}

export default function CheckoutStatusPreview({
  paymentMethodLabel,
  shippingMethodLabel,
  currentStatus,
  confirmed,
  confirmationId,
}: Props) {
  const activeIndex = resolveActiveIndex(currentStatus, confirmed)

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Status timeline</p>
          <p className="mt-1 text-sm text-slate-300">
            {confirmed
              ? 'Your order is in the system. Use the customer order view for live fulfillment updates.'
              : 'This is the path from checkout confirmation to final pickup or shipment.'}
          </p>
        </div>
        {confirmationId ? (
          <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
            {confirmationId}
          </div>
        ) : null}
      </div>
      <div className="grid gap-2">
        {DEFAULT_STEPS.map((step, index) => {
          const isComplete = confirmed && index < activeIndex
          const isCurrent = index === activeIndex
          return (
            <div
              key={step.key}
              className={`rounded-xl border px-4 py-3 ${
                isCurrent
                  ? 'border-brand-400/30 bg-brand-500/10'
                  : isComplete
                    ? 'border-emerald-400/25 bg-emerald-500/10'
                    : 'border-white/10 bg-black/20'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{step.label}</p>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  {isCurrent ? 'Current' : isComplete ? 'Complete' : 'Upcoming'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300">{step.detail}</p>
            </div>
          )
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 text-xs text-slate-300">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-slate-500">Payment path</p>
          <p className="mt-1 font-medium text-white">{paymentMethodLabel}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-slate-500">Fulfillment path</p>
          <p className="mt-1 font-medium text-white">{shippingMethodLabel}</p>
        </div>
      </div>
    </div>
  )
}
