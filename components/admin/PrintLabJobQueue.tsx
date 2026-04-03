"use client"

import { useCallback, useMemo, useState } from 'react'

type QueueJob = {
  id: string
  orderId: string
  orderItemId: string | null
  sourceJobId: string
  printLabJobId: string | null
  status: string
  printerId: string | null
  printerName: string | null
  queueItemId: string | null
  modelId: string
  modelName: string | null
  fileName: string | null
  filePath: string | null
  lastSubmittedAt: string | Date | null
  lastCallbackAt: string | Date | null
  startedAt: string | Date | null
  completedAt: string | Date | null
  submitAttempts: number
  callbackCount: number
  lastError: string | null
  metadata: unknown
  history: unknown
  createdAt: string | Date
  updatedAt: string | Date
  order: {
    orderNumber: number | null
    customerEmail: string | null
    customerName: string | null
  }
}

type Props = {
  initialJobs: QueueJob[]
  totalCount: number
  failedCount: number
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function formatDate(value?: string | Date | null) {
  if (!value) return '-'
  try {
    return dateFormatter.format(new Date(value))
  } catch {
    return value instanceof Date ? value.toISOString() : value
  }
}

function formatOrderNumber(orderNumber?: number | null) {
  if (!orderNumber || orderNumber <= 0) return 'Draft order'
  return `MW-${orderNumber.toString().padStart(5, '0')}`
}

export default function PrintLabJobQueue({ initialJobs, totalCount, failedCount }: Props) {
  const [jobs, setJobs] = useState(initialJobs)
  const [summary, setSummary] = useState({ totalCount, failedCount })
  const [statusFilter, setStatusFilter] = useState('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (nextStatus = statusFilter) => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/printlab/jobs?limit=200&status=${encodeURIComponent(nextStatus)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to load PrintLab jobs')
      setJobs(Array.isArray(data.jobs) ? data.jobs : [])
      setSummary({
        totalCount: typeof data.totalCount === 'number' ? data.totalCount : totalCount,
        failedCount: typeof data.failedCount === 'number' ? data.failedCount : failedCount,
      })
      setMessage('Queue refreshed.')
    } catch (err: any) {
      setError(err?.message || 'Failed to load PrintLab jobs')
    } finally {
      setLoading(false)
    }
  }, [failedCount, statusFilter, totalCount])

  const resubmit = useCallback(async (jobId: string) => {
    setBusyId(jobId)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/printlab/jobs/${encodeURIComponent(jobId)}/resubmit`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to resubmit job')
      await refresh()
      setMessage('PrintLab job resubmitted.')
    } catch (err: any) {
      setError(err?.message || 'Failed to resubmit job')
    } finally {
      setBusyId(null)
    }
  }, [refresh])

  const failedLoaded = useMemo(
    () => jobs.filter((job) => job.status === 'failed' || job.status === 'submit_failed').length,
    [jobs],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm text-slate-400">Queue size</p>
          <p className="text-2xl font-semibold">{jobs.length} <span className="text-base text-slate-500">loaded</span></p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Failures</p>
          <p className="text-2xl font-semibold">{failedLoaded}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">All-time</p>
          <p className="text-2xl font-semibold">{summary.totalCount}</p>
        </div>
        <div className="flex-1 min-w-[200px]" />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-40"
            value={statusFilter}
            onChange={(e) => {
              const next = e.target.value
              setStatusFilter(next)
              void refresh(next)
            }}
            disabled={loading}
          >
            <option value="all">All jobs</option>
            <option value="pending_submission">Pending submission</option>
            <option value="queued">Queued</option>
            <option value="started">Started</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="submit_failed">Submit failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button type="button" className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-amber-400">{error}</div>}
      {message && <div className="text-sm text-emerald-300">{message}</div>}
      <div className="space-y-3">
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-slate-400">
            No PrintLab jobs match this filter.
          </div>
        ) : null}
        {jobs.map((job) => {
          const isExpanded = Boolean(expanded[job.id])
          return (
            <div key={job.id} className="border border-white/10 rounded-lg bg-white/5 p-4 space-y-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[220px] space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-slate-100">
                      {job.status}
                    </span>
                    <span className="text-sm text-slate-400">{job.printLabJobId || job.sourceJobId}</span>
                  </div>
                  <div className="text-base font-medium">{job.modelName || job.modelId}</div>
                  <div className="text-xs text-slate-400">
                    {formatOrderNumber(job.order.orderNumber)} | Created {formatDate(job.createdAt)}
                  </div>
                </div>
                <div className="text-sm text-slate-300">
                  <div>Printer: {job.printerName || job.printerId || 'unassigned'}</div>
                  <div>Queue item: {job.queueItemId || 'n/a'}</div>
                  <div>Customer: {job.order.customerName || job.order.customerEmail || 'n/a'}</div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-md border border-white/15 text-xs hover:border-white/30"
                    onClick={() => setExpanded((prev) => ({ ...prev, [job.id]: !prev[job.id] }))}
                  >
                    {isExpanded ? 'Hide details' : 'Show details'}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-md border border-brand-400/40 text-xs hover:border-brand-300 disabled:opacity-50"
                    onClick={() => void resubmit(job.id)}
                    disabled={busyId === job.id}
                  >
                    {busyId === job.id ? 'Resubmitting...' : 'Resubmit'}
                  </button>
                </div>
              </div>
              {job.lastError ? <p className="text-xs text-rose-200">Error: {job.lastError}</p> : null}
              {isExpanded ? (
                <div className="text-xs text-slate-300 space-y-3 border-t border-white/10 pt-3">
                  <div className="grid lg:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-white/5 p-3 bg-black/10 space-y-1">
                      <p className="text-sm font-semibold">Lifecycle</p>
                      <p>Submitted: {formatDate(job.lastSubmittedAt)}</p>
                      <p>Last callback: {formatDate(job.lastCallbackAt)}</p>
                      <p>Started: {formatDate(job.startedAt)}</p>
                      <p>Completed: {formatDate(job.completedAt)}</p>
                      <p>Submit attempts: {job.submitAttempts}</p>
                      <p>Callbacks: {job.callbackCount}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 p-3 bg-black/10 space-y-1">
                      <p className="text-sm font-semibold">Linkage</p>
                      <p>Order id: {job.orderId}</p>
                      <p>Order item id: {job.orderItemId || 'n/a'}</p>
                      <p>Source job id: {job.sourceJobId}</p>
                      <p>PrintLab job id: {job.printLabJobId || 'pending upstream id'}</p>
                      <p>File: {job.fileName || job.filePath || 'n/a'}</p>
                    </div>
                  </div>
                  {job.history ? (
                    <pre className="bg-black/30 rounded p-2 text-[11px] whitespace-pre-wrap break-all">
                      {JSON.stringify(job.history, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
