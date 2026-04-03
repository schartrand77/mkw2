"use client"

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FULFILLMENT_STATUS_OPTIONS,
  ORDERWORKS_JOB_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  type OrderWorksJobStatus,
} from '@/lib/orderworks-status'

type FulfillmentStatus = 'pending' | 'ready' | 'picked_up' | 'shipped'

type Props = {
  jobId: string
  paymentIntentId: string
  initialStatus: OrderWorksJobStatus
  initialFulfillmentStatus: FulfillmentStatus
  initialPaymentMethod: string
  initialPaymentStatus: string
}

export default function UserOrderJobControls({
  jobId,
  paymentIntentId,
  initialStatus,
  initialFulfillmentStatus,
  initialPaymentMethod,
  initialPaymentStatus,
}: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<OrderWorksJobStatus>(initialStatus)
  const [fulfillmentStatus, setFulfillmentStatus] = useState<FulfillmentStatus>(initialFulfillmentStatus)
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod)
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus)
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const paymentMethodKnown = paymentMethod ? PAYMENT_METHOD_OPTIONS.some((entry) => entry.value === paymentMethod) : true
  const paymentStatusKnown = paymentStatus ? PAYMENT_STATUS_OPTIONS.some((entry) => entry.value === paymentStatus) : true

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setBusy('save')
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(paymentIntentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          fulfillmentStatus,
          paymentMethod: paymentMethod.trim() ? paymentMethod.trim() : null,
          paymentStatus: paymentStatus.trim() ? paymentStatus.trim() : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to update job')
      setMessage('Job updated.')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to update job')
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Delete this job? This also removes the linked order.')
      if (!confirmed) return
    }
    setBusy('delete')
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/orderworks/jobs/${jobId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to delete job')
      setMessage('Job deleted.')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to delete job')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Linked job: {paymentIntentId}</p>
        <button
          type="button"
          className="px-2 py-1 rounded-md border border-white/20 text-xs hover:border-white/40"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Hide job tools' : 'Edit job'}
        </button>
      </div>
      {expanded && (
        <form className="space-y-2" onSubmit={handleSave}>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="text-xs text-slate-400 flex flex-col gap-1">
              Job status
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderWorksJobStatus)}
                disabled={!!busy}
              >
                {ORDERWORKS_JOB_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400 flex flex-col gap-1">
              Fulfillment
              <select
                className="input"
                value={fulfillmentStatus}
                onChange={(e) => setFulfillmentStatus(e.target.value as FulfillmentStatus)}
                disabled={!!busy}
              >
                {FULFILLMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="text-xs text-slate-400 flex flex-col gap-1">
              Payment method
              <select
                className="input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={!!busy}
              >
                <option value="">Not set</option>
                {!paymentMethodKnown && paymentMethod && (
                  <option value={paymentMethod}>Custom ({paymentMethod})</option>
                )}
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400 flex flex-col gap-1">
              Payment status
              <select
                className="input"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                disabled={!!busy}
              >
                <option value="">Not set</option>
                {!paymentStatusKnown && paymentStatus && (
                  <option value={paymentStatus}>Custom ({paymentStatus})</option>
                )}
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          {error && <p className="text-xs text-rose-300">{error}</p>}
          {message && <p className="text-xs text-emerald-300">{message}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md border border-white/20 text-xs hover:border-white/40 disabled:opacity-50"
              disabled={!!busy}
            >
              {busy === 'save' ? 'Saving...' : 'Save job'}
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md border border-rose-400/50 text-rose-200 text-xs hover:border-rose-300 disabled:opacity-50"
              onClick={handleDelete}
              disabled={!!busy}
            >
              {busy === 'delete' ? 'Deleting...' : 'Delete job'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
