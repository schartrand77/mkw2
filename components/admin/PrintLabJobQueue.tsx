"use client"

import { useCallback, useMemo, useState } from 'react'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'
import { formatPaymentMethod, formatPaymentStatus } from '@/lib/orderworks-status'
import type { ProductionQueueClientJob, ProductionQueueClientSnapshot } from '@/lib/production'

type StatusFilter = 'all' | 'queued' | 'printing' | 'post_process' | 'failed'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return dateFormatter.format(date)
}

function formatMoney(cents?: number | null, currency?: string | null) {
  const amount = Math.max(0, Number.isFinite(Number(cents)) ? Number(cents) : 0) / 100
  const code = (currency || 'USD').toUpperCase()
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${code} ${amount.toFixed(2)}`
  }
}

function summarizeLineItems(items?: ProductionQueueClientJob['lineItems']) {
  if (!Array.isArray(items) || items.length === 0) return 'No line items recorded.'
  const totalQty = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0)
  const first = items[0]?.modelTitle || 'Print job'
  return items.length === 1 ? `${totalQty}x ${first}` : `${totalQty} parts across ${items.length} line items`
}

function printLabLabel(job: ProductionQueueClientJob) {
  if (!job.printLabStatus) return 'not submitted yet'
  return [
    job.printLabStatus,
    job.printLabPrinterName,
    job.printLabJobId,
  ].filter(Boolean).join(' - ')
}

export default function PrintLabJobQueue({ initialSnapshot, initialSearch = '' }: {
  initialSnapshot: ProductionQueueClientSnapshot
  initialSearch?: string
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState(initialSearch)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/production', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to load jobs')
      const jobs = Array.isArray(data?.orders)
        ? data.orders.map((order: any) => ({
            id: order.id,
            orderNumber: order.orderNumber ?? null,
            orderLabel: order.orderNumber ? `MW-${String(order.orderNumber).padStart(5, '0')}` : 'Draft order',
            status: order.status,
            createdAt: order.createdAt,
            customerName: order.customerName ?? null,
            customerEmail: order.customerEmail ?? null,
            paymentMethod: order.paymentMethod ?? null,
            paymentStatus: order.paymentStatus ?? null,
            totalCents: order.totalCents ?? null,
            currency: order.currency ?? null,
            contributionType: order.contributionType ?? null,
            donatedAmountCents: order.donatedAmountCents ?? null,
            contributionSummary: null,
            lineItems: order.lineItems ?? [],
            printLabStatus: order.lastPrintLabSubmission?.status ?? null,
            printLabPrinterName: order.lastPrintLabSubmission?.printerName ?? null,
            printLabJobId: order.lastPrintLabSubmission?.printLabJobId ?? null,
            printLabError: order.lastPrintLabSubmission?.error ?? null,
            legacyJobStatus: order.orderWorksStatus ?? null,
            legacyJobError: order.orderWorksLastError ?? null,
            printerName: order.printerName ?? null,
            totalHours: order.totalHours,
            queuePosition: order.queuePosition,
            estimatedCompletionAt: order.estimatedCompletionAt,
          }))
        : []
      setSnapshot({
        generatedAt: data?.generatedAt || new Date().toISOString(),
        jobs,
        activeCount: jobs.length,
        totalCount: jobs.length,
        queueHours: Number(data?.queueHours || 0),
      })
      setMessage('Queue refreshed.')
    } catch (err: any) {
      setError(err?.message || 'Failed to refresh jobs')
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteOrderFromQueue = async (job: ProductionQueueClientJob) => {
    if (deletingOrderId) return
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Delete ${job.orderLabel} from production schedule? This cannot be undone.`)
      if (!confirmed) return
    }
    setDeletingOrderId(job.id)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/orders/${job.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to delete job')
      setSnapshot((prev) => ({
        ...prev,
        jobs: prev.jobs.filter((entry) => entry.id !== job.id),
        activeCount: Math.max(0, prev.activeCount - 1),
        totalCount: Math.max(0, prev.totalCount - 1),
      }))
      pushSessionNotification({ type: 'success', title: 'Job deleted', message: `${job.orderLabel} was removed.` })
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete job'
      setError(msg)
      pushSessionNotification({ type: 'error', title: 'Delete failed', message: msg })
    } finally {
      setDeletingOrderId(null)
    }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredJobs = useMemo(() => {
    return snapshot.jobs.filter((job) => {
      if (statusFilter !== 'all' && job.status !== statusFilter) return false
      if (!normalizedSearch) return true
      const lineItemText = (job.lineItems || []).map((item) => [
        item.modelTitle,
        item.material,
      ].filter(Boolean).join(' ')).join(' ')
      const haystack = [
        job.id,
        job.orderLabel,
        job.customerName,
        job.customerEmail,
        job.status,
        job.paymentMethod,
        job.paymentStatus,
        job.printLabStatus,
        job.printLabPrinterName,
        job.printLabJobId,
        lineItemText,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [snapshot.jobs, statusFilter, normalizedSearch])

  const queuedCount = filteredJobs.filter((job) => job.status === 'queued').length
  const printLabCount = filteredJobs.filter((job) => job.printLabStatus).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm text-slate-400">Current jobs</p>
          <p className="text-2xl font-semibold">{filteredJobs.length} <span className="text-base text-slate-500">shown</span></p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Queued</p>
          <p className="text-2xl font-semibold">{queuedCount}</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">PrintLab handoffs</p>
          <p className="text-2xl font-semibold">{printLabCount}</p>
        </div>
        <div className="flex-1 min-w-[200px]" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-48"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search jobs..."
            aria-label="Search jobs"
          />
          <select className="input w-36" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">All current</option>
            <option value="queued">Queued</option>
            <option value="printing">Printing</option>
            <option value="post_process">Post-process</option>
            <option value="failed">Failed</option>
          </select>
          <button type="button" className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20" onClick={refresh} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      {error ? <div className="text-sm text-amber-400">{error}</div> : null}
      {message ? <div className="text-sm text-emerald-300">{message}</div> : null}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-slate-400">
            No current jobs match this filter.
          </div>
        ) : null}
        {filteredJobs.map((job) => {
          const isExpanded = Boolean(expanded[job.id])
          return (
            <div key={job.id} className="border border-white/10 rounded-lg bg-white/5 p-4 space-y-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[220px] space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <OrderStatusBadge status={job.status} />
                    <span className="text-sm text-slate-400">{job.orderLabel}</span>
                    {job.printLabStatus ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${job.printLabStatus === 'failed' || job.printLabStatus === 'submit_failed' ? 'bg-rose-500/20 text-rose-100' : 'bg-emerald-500/20 text-emerald-100'}`}>
                        PrintLab {job.printLabStatus}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-base font-medium">{job.customerName || job.customerEmail || 'Customer order'}</div>
                  <div className="text-xs text-slate-400">Created {formatDate(job.createdAt)}</div>
                  <div className="text-xs text-slate-400">{summarizeLineItems(job.lineItems)}</div>
                </div>
                <div className="text-sm text-slate-300">
                  <div>Total: {formatMoney(job.totalCents, job.currency)}</div>
                  <div>Payment: {formatPaymentMethod(job.paymentMethod)} ({formatPaymentStatus(job.paymentStatus)})</div>
                  <div>Printer: {job.printerName || job.printLabPrinterName || 'Unassigned'}</div>
                  <div>PrintLab: {printLabLabel(job)}</div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-md border border-white/15 text-xs hover:border-white/30"
                    onClick={() => setExpanded((prev) => ({ ...prev, [job.id]: !prev[job.id] }))}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? 'Hide details' : 'Show details'}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-md border border-rose-400/50 text-xs text-rose-200 hover:border-rose-300 disabled:opacity-50"
                    onClick={() => deleteOrderFromQueue(job)}
                    disabled={deletingOrderId === job.id}
                  >
                    {deletingOrderId === job.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
              {isExpanded ? (
                <div className="text-xs text-slate-300 space-y-3 border-t border-white/10 pt-3">
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-white/5 p-3 bg-black/10">
                      <p className="text-sm font-semibold mb-1">Queue</p>
                      <p>Position: {job.queuePosition ?? '-'}</p>
                      <p>Estimated hours: {job.totalHours.toFixed(1)}</p>
                      <p>Projected completion: {formatDate(job.estimatedCompletionAt)}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 p-3 bg-black/10">
                      <p className="text-sm font-semibold mb-1">PrintLab</p>
                      <p>Status: {job.printLabStatus || 'not submitted'}</p>
                      <p>Printer: {job.printLabPrinterName || 'N/A'}</p>
                      <p>Job ID: {job.printLabJobId || 'N/A'}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 p-3 bg-black/10">
                      <p className="text-sm font-semibold mb-1">Payment</p>
                      <p>Method: {formatPaymentMethod(job.paymentMethod)}</p>
                      <p>Status: {formatPaymentStatus(job.paymentStatus)}</p>
                      <p>{job.contributionSummary || 'Paid production job'}</p>
                    </div>
                  </div>
                  {job.printLabError ? <p className="text-rose-200">PrintLab error: {job.printLabError}</p> : null}
                  {job.legacyJobError ? <p className="text-rose-200">Legacy job error: {job.legacyJobError}</p> : null}
                  <div>
                    <p className="text-sm font-semibold mb-1">Line items</p>
                    <div className="flex flex-wrap gap-2">
                      {(job.lineItems || []).map((item, index) => (
                        <span key={`${job.id}-${index}`} className="rounded-md border border-white/10 px-2 py-1">
                          {item.quantity}x {item.modelTitle}{item.material ? ` - ${item.material}` : ''} - {formatMoney(item.totalCents, job.currency)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
