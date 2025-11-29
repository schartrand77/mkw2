"use client"

import { useCallback, useMemo, useState } from 'react'

type JobStatus = 'pending' | 'sent'
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
  webhookAttempts: number
  lastAttemptAt?: string | null
  lastError?: string | null
  createdAt: string
  updatedAt: string
  user?: { id: string; name: string | null; email: string | null } | null
}

type Props = {
  initialJobs: JobRecord[]
  pendingCount: number
  totalCount: number
  orderWorksEnabled: boolean
}

type Summary = Pick<Props, 'pendingCount' | 'totalCount' | 'orderWorksEnabled'>

const formatterCache = new Map<string, Intl.NumberFormat>()
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

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

export default function JobQueue({ initialJobs, pendingCount, totalCount, orderWorksEnabled }: Props) {
  const [jobs, setJobs] = useState<JobRecord[]>(initialJobs)
  const [summary, setSummary] = useState<Summary>({ pendingCount, totalCount, orderWorksEnabled })
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sent'>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<Record<string, 'retry' | 'delete' | null>>({})

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const updateJob = (next: JobRecord) => {
    setJobs((prev) => {
      const exists = prev.find((job) => job.id === next.id)
      if (exists) {
        return prev.map((j) => (j.id === next.id ? next : j))
      }
      return [next, ...prev]
    })
  }

  const removeJob = (id: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== id))
  }

  const refresh = useCallback(async (overrideStatus?: 'all' | 'pending' | 'sent') => {
    const status = overrideStatus || statusFilter
    setLoading(true); setError(null); setMessage(null)
    try {
      const res = await fetch(`/api/admin/orderworks/jobs?limit=200&status=${status}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load queue')
      setJobs(Array.isArray(data.jobs) ? data.jobs : [])
      setSummary({
        pendingCount: data.pendingCount ?? summary.pendingCount,
        totalCount: data.totalCount ?? summary.totalCount,
        orderWorksEnabled: Boolean(data.orderWorksEnabled ?? summary.orderWorksEnabled),
      })
      setMessage('Queue refreshed.')
    } catch (err: any) {
      setError(err?.message || 'Failed to refresh jobs')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, summary.pendingCount, summary.totalCount, summary.orderWorksEnabled])

  const handleRetry = async (id: string) => {
    setBusy((prev) => ({ ...prev, [id]: 'retry' }))
    setError(null); setMessage(null)
    try {
      const res = await fetch(`/api/admin/orderworks/jobs/${id}/retry`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Retry failed')
      if (data.job) updateJob(data.job)
      setMessage('Job resent to OrderWorks.')
    } catch (err: any) {
      setError(err?.message || 'Failed to resend job')
    } finally {
      setBusy((prev) => ({ ...prev, [id]: null }))
    }
  }

  const handleDelete = async (id: string) => {
    const jobToDelete = jobs.find((job) => job.id === id)
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Delete this job form? This cannot be undone.')
      if (!confirmed) return
    }
    setBusy((prev) => ({ ...prev, [id]: 'delete' }))
    setError(null); setMessage(null)
    try {
      const res = await fetch(`/api/admin/orderworks/jobs/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to delete job')
      removeJob(id)
      setSummary((prev) => ({
        ...prev,
        totalCount: Math.max(0, prev.totalCount - 1),
        pendingCount: jobToDelete?.status === 'pending'
          ? Math.max(0, prev.pendingCount - 1)
          : prev.pendingCount,
      }))
      setMessage('Job deleted.')
    } catch (err: any) {
      setError(err?.message || 'Failed to delete job')
    } finally {
      setBusy((prev) => ({ ...prev, [id]: null }))
    }
  }

  const handleFilterChange = (value: 'all' | 'pending' | 'sent') => {
    setStatusFilter(value)
    refresh(value).catch(() => {})
  }

  const pendingJobs = useMemo(() => jobs.filter((job) => job.status === 'pending').length, [jobs])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm text-slate-400">Queue size</p>
          <p className="text-2xl font-semibold">
            {jobs.length} <span className="text-base text-slate-500">loaded</span>
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Pending</p>
          <p className="text-2xl font-semibold">{pendingJobs}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">All-time</p>
          <p className="text-2xl font-semibold">{summary.totalCount}</p>
        </div>
        <div className="flex-1 min-w-[200px]" />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-32"
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value as 'all' | 'pending' | 'sent')}
            disabled={loading}
          >
            <option value="all">All jobs</option>
            <option value="pending">Pending only</option>
            <option value="sent">Sent</option>
          </select>
          <button type="button" className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20" onClick={() => refresh()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      {!summary.orderWorksEnabled && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          ORDERWORKS_WEBHOOK_URL is not configured. Retries will fail until the webhook URL (and optional secret) are set in the environment.
        </div>
      )}
      {error && <div className="text-sm text-amber-400">{error}</div>}
      {message && <div className="text-sm text-emerald-300">{message}</div>}
      <div className="space-y-3">
        {jobs.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-slate-400">
            No jobs match this filter.
          </div>
        )}
        {jobs.map((job) => {
          const isExpanded = !!expanded[job.id]
          const busyState = busy[job.id]
          const lineItems = Array.isArray(job.lineItems) ? job.lineItems : []
          const shipping = job.shipping && typeof job.shipping === 'object' ? job.shipping : null
          return (
            <div key={job.id} className="border border-white/10 rounded-lg bg-white/5 p-4 space-y-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[220px] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${job.status === 'pending' ? 'bg-amber-400/20 text-amber-100' : 'bg-emerald-500/20 text-emerald-100'}`}>
                      {job.status}
                    </span>
                    <span className="text-sm text-slate-400">#{job.paymentIntentId}</span>
                  </div>
                  <div className="text-base font-medium">{formatCurrency(job.totalCents, job.currency)}</div>
                  <div className="text-xs text-slate-400">
                    Created {formatDate(job.createdAt)} • Attempts {job.webhookAttempts}
                    {job.lastAttemptAt && ` • Last attempt ${formatDate(job.lastAttemptAt)}`}
                  </div>
                  {job.lastError && (
                    <div className="text-xs text-rose-300">Last error: {job.lastError}</div>
                  )}
                </div>
                <div className="text-sm text-slate-300">
                  <div>
                    User:{' '}
                    {job.user
                      ? `${job.user.name || job.user.email} (${job.user.email || 'no email'})`
                      : 'anonymous'}
                  </div>
                  <div>Customer email: {job.customerEmail || '—'}</div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-md border border-white/15 text-xs hover:border-white/30 disabled:opacity-50"
                    onClick={() => toggleExpanded(job.id)}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? 'Hide details' : 'Show details'}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-md border border-brand-400/50 text-xs text-brand-200 hover:border-brand-300 disabled:opacity-50"
                    onClick={() => handleRetry(job.id)}
                    disabled={busyState === 'retry' || !summary.orderWorksEnabled}
                  >
                    {busyState === 'retry' ? 'Retrying…' : 'Retry'}
                  </button>
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
