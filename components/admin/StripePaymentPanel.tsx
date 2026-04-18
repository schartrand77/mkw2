'use client'

import { useState } from 'react'

type StripePaymentPanelProps = {
  orderId: string
  paymentIntentId?: string | null
  paymentStatus?: string | null
  chargeId?: string | null
  customerId?: string | null
  receiptUrl?: string | null
  totalCents: number
  refundedCents?: number | null
  currency: string
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(cents / 100)
}

export default function StripePaymentPanel({
  orderId,
  paymentIntentId,
  paymentStatus,
  chargeId,
  customerId,
  receiptUrl,
  totalCents,
  refundedCents,
  currency,
}: StripePaymentPanelProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const remainingCents = Math.max(0, totalCents - (refundedCents || 0))

  async function sync() {
    setBusy('sync')
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/stripe-sync`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Stripe sync failed')
      setMessage(`Synced: ${data.paymentStatus || 'unknown'}`)
      window.location.reload()
    } catch (err: any) {
      setMessage(err?.message || 'Stripe sync failed')
    } finally {
      setBusy(null)
    }
  }

  async function refund() {
    setBusy('refund')
    setMessage(null)
    try {
      const trimmed = amount.trim()
      const amountCents = trimmed ? Math.round(Number(trimmed) * 100) : undefined
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, reason: 'requested_by_customer' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Refund failed')
      setMessage(`Refund created: ${formatMoney(data.amount || 0, currency)}`)
      window.location.reload()
    } catch (err: any) {
      setMessage(err?.message || 'Refund failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-xl border border-white/10 p-4 bg-black/20 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Stripe</h2>
        <span className="text-xs rounded-md border border-white/10 px-2 py-1 text-slate-300">
          {paymentStatus || 'unknown'}
        </span>
      </div>
      <div className="grid gap-2 text-xs text-slate-300">
        <div>
          <p className="text-slate-500">PaymentIntent</p>
          <p className="break-all">{paymentIntentId || 'Not recorded'}</p>
        </div>
        <div>
          <p className="text-slate-500">Charge</p>
          <p className="break-all">{chargeId || 'Not recorded'}</p>
        </div>
        <div>
          <p className="text-slate-500">Customer</p>
          <p className="break-all">{customerId || 'Not recorded'}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-slate-500">Refunded</p>
            <p>{formatMoney(refundedCents || 0, currency)} of {formatMoney(totalCents, currency)}</p>
          </div>
          {receiptUrl ? (
            <a className="text-xs underline underline-offset-4 hover:text-white" href={receiptUrl} target="_blank" rel="noreferrer">
              Receipt
            </a>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sync}
          disabled={busy !== null || !paymentIntentId}
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs hover:border-white/40 disabled:opacity-50"
        >
          {busy === 'sync' ? 'Syncing...' : 'Sync Stripe'}
        </button>
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          placeholder={formatMoney(remainingCents, currency)}
          className="w-28 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
        />
        <button
          type="button"
          onClick={refund}
          disabled={busy !== null || !paymentIntentId || remainingCents <= 0}
          className="rounded-md border border-rose-300/30 px-3 py-1.5 text-xs text-rose-100 hover:border-rose-200 disabled:opacity-50"
        >
          {busy === 'refund' ? 'Refunding...' : 'Refund'}
        </button>
      </div>
      {message ? <p className="text-xs text-slate-300">{message}</p> : null}
    </div>
  )
}
