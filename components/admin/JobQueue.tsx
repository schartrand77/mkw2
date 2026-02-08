"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

type JobStatus = 'pending' | 'sent'
type FulfillmentStatus = 'pending' | 'ready' | 'picked_up' | 'shipped'
type JobRecord = {
  id: string
  paymentIntentId: string
  userId?: string | null
  customerEmail?: string | null
  status: JobStatus
  totalCents: number
  currency: string
  lineItems: any
  shipping?: any
  metadata?: any
  paymentMethod?: string | null
  paymentStatus?: string | null
  fulfillmentStatus?: FulfillmentStatus | null
  fulfilledAt?: string | null
  createdAt: string
  updatedAt: string
  user?: { id: string; name: string | null; email: string | null } | null
}

type Props = {
  initialJobs: JobRecord[]
  pendingCount: number
  totalCount: number
}

type Summary = Pick<Props, 'pendingCount' | 'totalCount'>

const formatterCache = new Map<string, Intl.NumberFormat>()
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const FULFILLMENT_OPTIONS: { value: FulfillmentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'ready', label: 'Ready for pickup' },
  { value: 'picked_up', label: 'Picked up' },
  { value: 'shipped', label: 'Shipped' },
]
const FULFILLMENT_LABELS = FULFILLMENT_OPTIONS.reduce<Record<string, string>>((acc, option) => {
  acc[option.value] = option.label
  return acc
}, {})

function renderFileCell(item: any) {
  const path = typeof item?.storagePath === 'string' && item.storagePath.trim().length > 0 ? item.storagePath : null
  const url = typeof item?.storageUrl === 'string' && item.storageUrl.trim().length > 0 ? item.storageUrl : null
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="underline text-brand-300 hover:text-brand-200">
        Download
      </a>
    )
  }
  if (path) {
    return <code className="text-[11px] break-all">{path}</code>
  }
  return <span className="text-slate-500">�</span>
}

function formatCurrency(amountCents: number, currency: string) {
  const key = currency.toUpperCase()
  if (!formatterCache.has(key)) {
    formatterCache.set(
      key,
      new Intl.NumberFormat(undefined, { style: 'currency', currency: key }),
    )
  }
  const fmt = formatterCache.get(key)!
  return fmt.format((amountCents || 0) / 100)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return dateFormatter.format(new Date(value))
  } catch {
    return value
  }
}

function formatFulfillment(status?: FulfillmentStatus | null) {
  if (!status) return 'Pending'
  return FULFILLMENT_LABELS[status] || status
}

type StatusFormProps = {
  job: JobRecord
  onUpdated: (job: JobRecord) => void
}

function JobStatusControls({ job, onUpdated }: StatusFormProps) {
  const [jobStatus, setJobStatus] = useState<JobStatus>(job.status)
  const [fulfillmentStatus, setFulfillmentStatus] = useState<FulfillmentStatus>(job.fulfillmentStatus || 'pending')
  const [paymentStatus, setPaymentStatus] = useState(job.paymentStatus || '')
  const [paymentMethod, setPaymentMethod] = useState(job.paymentMethod || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setJobStatus(job.status)
    setFulfillmentStatus(job.fulfillmentStatus || 'pending')
    setPaymentStatus(job.paymentStatus || '')
    setPaymentMethod(job.paymentMethod || '')
  }, [job.status, job.fulfillmentStatus, job.paymentStatus, job.paymentMethod])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(job.paymentIntentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: jobStatus,
          fulfillmentStatus,
          paymentStatus: paymentStatus.trim() ? paymentStatus.trim() : null,
          paymentMethod: paymentMethod.trim() ? paymentMethod.trim() : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to update job status')
      if (data.job) {
        onUpdated(data.job)
      }
      setSuccess('Status updated.')
    } catch (err: any) {
      setError(err?.message || 'Failed to update job status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="text-xs text-slate-400 flex flex-col gap-1">
          Job status
          <select className="input" value={jobStatus} onChange={(e) => setJobStatus(e.target.value as JobStatus)} disabled={saving}>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
          </select>
        </label>
        <label className="text-xs text-slate-400 flex flex-col gap-1">
          Fulfillment status
          <select
            className="input"
            value={fulfillmentStatus}
            onChange={(e) => setFulfillmentStatus(e.target.value as FulfillmentStatus)}
            disabled={saving}
          >
            {FULFILLMENT_OPTIONS.map((option) => (
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
          <input
            className="input"
            type="text"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            placeholder="card / cash / other"
            disabled={saving}
          />
        </label>
        <label className="text-xs text-slate-400 flex flex-col gap-1">
          Payment status
          <input
            className="input"
            type="text"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            placeholder="succeeded / pending"
            disabled={saving}
          />
        </label>
      </div>
      {error && <div className="text-xs text-rose-300">{error}</div>}
      {success && <div className="text-xs text-emerald-300">{success}</div>}
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-md border border-rose-400/50 text-xs text-rose-200 hover:border-rose-300 disabled:opacity-50"
                    onClick={() => handleDelete(job.id)}
                    disabled={busyState === 'delete'}
                  >
                    {busyState === 'delete' ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="text-xs text-slate-300 space-y-3 border-t border-white/10 pt-3">
                  <div className="grid lg:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-white/5 p-3 bg-black/10 space-y-1">
                      <p className="text-sm font-semibold">Payment & fulfillment</p>
                      <p>Method: {job.paymentMethod || 'N/A'}</p>
                      <p>Status: {job.paymentStatus || 'N/A'}</p>
                      <p>Fulfillment: {formatFulfillment(job.fulfillmentStatus)}</p>
                      <p>Fulfilled at: {job.fulfilledAt ? formatDate(job.fulfilledAt) : 'N/A'}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 p-3 bg-black/10">
                      <p className="text-sm font-semibold mb-2">Update statuses</p>
                      <JobStatusControls job={job} onUpdated={updateJob} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1">Line items</p>
                    {lineItems.length === 0 ? (
                      <p className="text-slate-500">No line items recorded.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="text-slate-500">
                            <tr>
                              <th className="py-1 pr-2">Title</th>
                              <th className="py-1 pr-2">Qty</th>
                              <th className="py-1 pr-2">Material</th>
                              <th className="py-1 pr-2">Line total</th>
                              <th className="py-1 pr-2">File</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems.map((item: any, idx: number) => (
                              <tr key={`${job.id}-${idx}`} className="border-t border-white/5">
                                <td className="py-1 pr-2">{item?.title || item?.modelId || 'Item'}</td>
                                <td className="py-1 pr-2">{item?.qty ?? '—'}</td>
                                <td className="py-1 pr-2">{item?.material || 'PLA'}</td>
                                <td className="py-1 pr-2">{typeof item?.lineTotal === 'number' ? formatCurrency(Math.round(item.lineTotal * 100), job.currency) : '—'}</td>
                                <td className="py-1 pr-2">{renderFileCell(item)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm font-semibold mb-1">Shipping</p>
                      {shipping ? (
                        <div className="space-y-1">
                          <div>Method: {shipping.method || 'pickup'}</div>
                          {shipping.address && (
                            <div className="text-slate-400">
                              <div>{shipping.address.name}</div>
                              <div>{shipping.address.line1}</div>
                              {shipping.address.line2 && <div>{shipping.address.line2}</div>}
                              <div>
                                {shipping.address.city}
                                {shipping.address.state ? `, ${shipping.address.state}` : ''}
                              </div>
                              <div>
                                {shipping.address.postalCode}{' '}
                                {shipping.address.country ? `(${shipping.address.country})` : ''}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-500">No shipping data.</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-1">Metadata</p>
                      {job.metadata ? (
                        <pre className="bg-black/30 rounded p-2 text-[11px] whitespace-pre-wrap break-all">
                          {JSON.stringify(job.metadata, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-slate-500">None.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
