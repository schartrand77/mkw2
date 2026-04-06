'use client'

import { useEffect, useMemo, useState } from 'react'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'
import PrinterIdentity from '@/components/admin/PrinterIdentity'

type Printer = {
  id: string
  name: string
  status: string
  active: boolean
  dailyCapacityHours: number
  notes?: string | null
  provider?: string | null
  externalId?: string | null
  metadata?: unknown
  lastSeenAt?: string | null
}

type OrderEntry = {
  id: string
  orderNumber: number | null
  status: string
  createdAt: string
  customerName?: string | null
  customerEmail?: string | null
  orderWorksStatus?: string | null
  orderWorksLastError?: string | null
  printerId?: string | null
  printerName?: string | null
  failedAt?: string | null
  failureNote?: string | null
  totalHours: number
  queuePosition: number | null
  estimatedCompletionAt: string | null
}

type Snapshot = {
  generatedAt: string
  printers: Printer[]
  capacityHoursPerDay: number
  queueHours: number
  orderWorks: {
    totalJobs: number
    sentJobs: number
    pendingJobs: number
    unpaidJobs: number
  }
  orders: OrderEntry[]
}

const PRINTER_STATUSES = ['available', 'printing', 'maintenance', 'offline']

export default function ProductionDashboard({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newPrinter, setNewPrinter] = useState({ name: '', status: 'available', active: true, dailyCapacityHours: 8 })
  const [composer, setComposer] = useState<{ orderId: string; mode: 'request' | 'message' } | null>(null)
  const [composerDraft, setComposerDraft] = useState('')
  const [composerSending, setComposerSending] = useState(false)
  const [statusSnapshot, setStatusSnapshot] = useState<{ enabled: boolean; statuses: Record<string, any> }>({ enabled: false, statuses: {} })
  const [statusLoading, setStatusLoading] = useState(false)
  const [autoQueueing, setAutoQueueing] = useState(false)
  const [syncingPrintLab, setSyncingPrintLab] = useState(false)
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null)

  const formattedGeneratedAt = useMemo(() => formatDateTime(snapshot.generatedAt), [snapshot.generatedAt])
  const groupedOrders = useMemo(() => ({
    queued: snapshot.orders.filter((order) => order.status === 'queued'),
    printing: snapshot.orders.filter((order) => order.status === 'printing'),
    postProcess: snapshot.orders.filter((order) => order.status === 'post_process'),
    failed: snapshot.orders.filter((order) => order.status === 'failed'),
  }), [snapshot.orders])
  const exceptions = useMemo(() => snapshot.orders.filter((order) => (
    order.status === 'failed' || !order.printerId || Boolean(order.orderWorksLastError) || order.queuePosition == null
  )), [snapshot.orders])
  const atRiskOrders = useMemo(() => snapshot.orders.filter((order) => (
    typeof order.queuePosition === 'number' && order.queuePosition >= 6
  )), [snapshot.orders])

  const loadPrinterStatus = async () => {
    setStatusLoading(true)
    try {
      const res = await fetch('/api/admin/printers/status', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load printer status')
      setStatusSnapshot({ enabled: Boolean(data?.enabled), statuses: data?.statuses || {} })
    } catch {
      setStatusSnapshot({ enabled: false, statuses: {} })
    } finally {
      setStatusLoading(false)
    }
  }

  const refresh = async () => {
    setError(null)
    try {
      const res = await fetch('/api/admin/production', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to refresh')
      setSnapshot(data)
      await loadPrinterStatus()
    } catch (err: any) {
      setError(err?.message || 'Failed to refresh')
    }
  }

  const updatePrinter = async (id: string, payload: Partial<Printer>) => {
    setSaving(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/printers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to update printer')
      const nextPrinters = snapshot.printers.map((printer) => (printer.id === id ? data.printer : printer))
      setSnapshot((prev) => ({ ...prev, printers: nextPrinters }))
      await refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to update printer')
    } finally {
      setSaving(null)
    }
  }

  const removePrinter = async (id: string) => {
    setSaving(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/printers/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to delete printer')
      setSnapshot((prev) => ({ ...prev, printers: prev.printers.filter((printer) => printer.id !== id) }))
      await refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to delete printer')
    } finally {
      setSaving(null)
    }
  }

  const createPrinter = async () => {
    if (!newPrinter.name.trim()) {
      setError('Printer name is required.')
      return
    }
    setSaving('new')
    setError(null)
    try {
      const res = await fetch('/api/admin/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrinter),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create printer')
      setSnapshot((prev) => ({ ...prev, printers: [...prev.printers, data.printer] }))
      setNewPrinter({ name: '', status: 'available', active: true, dailyCapacityHours: 8 })
      await refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to create printer')
    } finally {
      setSaving(null)
    }
  }

  const autoAssignQueue = async () => {
    if (autoQueueing) return
    setAutoQueueing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/printers/auto-queue', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Auto-assign failed')
      pushSessionNotification({
        type: 'success',
        title: 'Auto-assign complete',
        message: `Assigned ${Array.isArray(data?.assignments) ? data.assignments.length : 0} job(s).`,
      })
      await refresh()
    } catch (err: any) {
      const message = err?.message || 'Auto-assign failed'
      setError(message)
      pushSessionNotification({ type: 'error', title: 'Auto-assign failed', message })
    } finally {
      setAutoQueueing(false)
    }
  }

  const syncPrintLab = async () => {
    if (syncingPrintLab) return
    setSyncingPrintLab(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/printers/sync-printlab', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Sync failed')
      pushSessionNotification({
        type: 'success',
        title: 'PrintLab synced',
        message: `Pulled ${Array.isArray(data?.printers) ? data.printers.length : 0} printer(s).`,
      })
      await refresh()
    } catch (err: any) {
      const message = err?.message || 'Sync failed'
      setError(message)
      pushSessionNotification({ type: 'error', title: 'Sync failed', message })
    } finally {
      setSyncingPrintLab(false)
    }
  }

  useEffect(() => {
    loadPrinterStatus()
  }, [])

  const openComposer = (orderId: string, mode: 'request' | 'message') => {
    setComposer({ orderId, mode })
    setComposerDraft('')
  }

  const closeComposer = () => {
    setComposer(null)
    setComposerDraft('')
  }

  const sendComposerMessage = async () => {
    if (!composer || !composerDraft.trim() || composerSending) return
    setComposerSending(true)
    setError(null)
    try {
      const endpoint = composer.mode === 'request'
        ? `/api/admin/orders/${composer.orderId}/approval-requests`
        : `/api/admin/orders/${composer.orderId}/messages`
      const payload = composer.mode === 'request'
        ? { message: composerDraft.trim() }
        : { body: composerDraft.trim() }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to send update')
      pushSessionNotification({
        type: 'success',
        title: composer.mode === 'request' ? 'Change request sent' : 'Message sent',
        message: composer.mode === 'request' ? 'Customer approval requested.' : 'Customer notified.',
      })
      setComposerDraft('')
      setComposer(null)
    } catch (err: any) {
      const message = err?.message || 'Failed to send update'
      setError(message)
      pushSessionNotification({ type: 'error', title: 'Send failed', message })
    } finally {
      setComposerSending(false)
    }
  }

  const deleteOrderFromSchedule = async (order: OrderEntry) => {
    if (deletingOrderId) return
    const label = order.orderNumber ? `MW-${order.orderNumber.toString().padStart(5, '0')}` : 'this job'
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Delete ${label} from production schedule? This cannot be undone.`)
      if (!confirmed) return
    }
    setDeletingOrderId(order.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to delete job')
      pushSessionNotification({
        type: 'success',
        title: 'Job deleted',
        message: `${label} was removed from production schedule.`,
      })
      await refresh()
    } catch (err: any) {
      const message = err?.message || 'Failed to delete job'
      setError(message)
      pushSessionNotification({ type: 'error', title: 'Delete failed', message })
    } finally {
      setDeletingOrderId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Production Scheduling</h1>
          <p className="text-sm text-slate-400 mt-1">Track capacity, OrderWorks syncs, and projected completion dates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-outline text-sm" type="button" onClick={refresh}>
            Refresh
          </button>
          <button className="btn btn-outline text-sm" type="button" onClick={autoAssignQueue} disabled={autoQueueing}>
            {autoQueueing ? 'Auto-assigning...' : 'Auto-assign queue'}
          </button>
          <button className="btn btn-outline text-sm" type="button" onClick={syncPrintLab} disabled={syncingPrintLab}>
            {syncingPrintLab ? 'Syncing PrintLab...' : 'Sync PrintLab'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="glass rounded-[1.75rem] border border-white/10 p-5 md:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.34em] text-brand-300/80">Production board</p>
            <h2 className="mt-2 text-2xl font-semibold">Queue flow by lane</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">
              Operators can scan the queue by current stage, then drop into exceptions and per-order actions without hunting across separate admin pages.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <WatchCard title="Queued" value={groupedOrders.queued.length} detail="Awaiting printer assignment or start." />
            <WatchCard title="Printing" value={groupedOrders.printing.length} detail="Currently active on a machine." />
            <WatchCard title="Post-process" value={groupedOrders.postProcess.length} detail="Cleanup, QA, and packing steps." />
            <WatchCard title="Exceptions" value={exceptions.length} detail="Need operator intervention." />
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-4">
          <QueueLane title="Queued" subtitle="Ready for scheduling." tone="amber" orders={groupedOrders.queued} />
          <QueueLane title="Printing" subtitle="Running or assigned." tone="sky" orders={groupedOrders.printing} />
          <QueueLane title="Post-process" subtitle="Finishing and packing." tone="emerald" orders={groupedOrders.postProcess} />
          <QueueLane title="Failed" subtitle="Blocked and needs recovery." tone="rose" orders={groupedOrders.failed} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Exception handling</p>
              <h2 className="mt-1 text-lg font-semibold">Orders needing attention</h2>
            </div>
            <span className="text-xs text-slate-400">{exceptions.length} flagged</span>
          </div>
          {exceptions.length === 0 ? (
            <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-5 text-sm text-emerald-100">
              No active exceptions. Queue assignment, integration state, and status flow all look healthy.
            </p>
          ) : (
            <div className="space-y-3">
              {exceptions.map((order) => (
                <div key={`exception-${order.id}`} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        {order.orderNumber ? `MW-${order.orderNumber.toString().padStart(5, '0')}` : 'Draft order'}
                      </p>
                      <p className="font-medium text-white">{order.customerName || order.customerEmail || 'Customer order'}</p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {!order.printerId && <ExceptionChip label="Printer unassigned" tone="amber" />}
                    {order.orderWorksLastError && <ExceptionChip label="OrderWorks error" tone="rose" />}
                    {order.status === 'failed' && <ExceptionChip label="Production failure" tone="rose" />}
                    {order.queuePosition == null && <ExceptionChip label="Missing queue position" tone="sky" />}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 text-xs text-slate-300">
                    <div>
                      <p className="text-slate-500">Estimated print hours</p>
                      <p className="mt-1 text-sm font-medium">{order.totalHours.toFixed(1)} hrs</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Projected completion</p>
                      <p className="mt-1 text-sm font-medium">{order.estimatedCompletionAt ? formatDateTime(order.estimatedCompletionAt) : 'Unscheduled'}</p>
                    </div>
                  </div>
                  {order.failureNote ? <p className="text-xs text-rose-200">Failure note: {order.failureNote}</p> : null}
                  {order.orderWorksLastError ? <p className="text-xs text-rose-200">OrderWorks: {order.orderWorksLastError}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Operational watchlist</p>
            <h2 className="mt-1 text-lg font-semibold">Immediate queue signals</h2>
          </div>
          <div className="space-y-3">
            <WatchCard title="Unassigned jobs" value={snapshot.orders.filter((order) => !order.printerId).length} detail="Orders still waiting for a specific machine." />
            <WatchCard title="At-risk queue depth" value={atRiskOrders.length} detail="Deeper queue items that may see lower ETA confidence." />
            <WatchCard title="Integration issues" value={snapshot.orders.filter((order) => Boolean(order.orderWorksLastError)).length} detail="Orders carrying OrderWorks errors or needing follow-up." />
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Capacity</p>
          <p className="text-2xl font-semibold">{snapshot.capacityHoursPerDay.toFixed(1)} hrs/day</p>
          <p className="text-xs text-slate-400">{snapshot.printers.filter((p) => p.active).length} active printers</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Queue workload</p>
          <p className="text-2xl font-semibold">{snapshot.queueHours.toFixed(1)} hrs</p>
          <p className="text-xs text-slate-400">Next refresh {formattedGeneratedAt}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">OrderWorks</p>
          <p className="text-2xl font-semibold">{snapshot.orderWorks.sentJobs} sent</p>
          <p className="text-xs text-slate-400">{snapshot.orderWorks.pendingJobs} pending • {snapshot.orderWorks.unpaidJobs} unpaid</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Printer availability</h2>
              <span className="text-xs text-slate-400">{snapshot.printers.length} total</span>
            </div>
            <div className="space-y-3">
              {snapshot.printers.map((printer) => (
                <div key={printer.id} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <PrinterIdentity
                        name={printer.name}
                        provider={printer.provider}
                        externalId={printer.externalId}
                        metadata={printer.metadata}
                        status={printer.status}
                        active={printer.active}
                        lastSeenAt={printer.lastSeenAt}
                        subtitle={printer.notes || undefined}
                      />
                      {statusSnapshot.enabled ? (
                        <p className="text-xs text-slate-400">
                          Status: {formatPrinterStatus(statusSnapshot.statuses[printer.id])}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">{statusLoading ? 'Loading status...' : 'Status feed inactive'}</p>
                      )}
                    </div>
                    <button
                      className="text-xs text-rose-300 hover:text-rose-200"
                      type="button"
                      disabled={saving === printer.id}
                      onClick={() => removePrinter(printer.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="space-y-1">
                      <span className="text-slate-400">Status</span>
                      <select
                        className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1"
                        value={printer.status}
                        onChange={(e) => updatePrinter(printer.id, { status: e.target.value })}
                        disabled={saving === printer.id}
                      >
                        {PRINTER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-400">Daily hours</span>
                      <input
                        className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1"
                        type="number"
                        min={0}
                        step={0.5}
                        value={printer.dailyCapacityHours}
                        onChange={(e) => updatePrinter(printer.id, { dailyCapacityHours: Number(e.target.value) })}
                        disabled={saving === printer.id}
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={printer.active}
                      onChange={(e) => updatePrinter(printer.id, { active: e.target.checked })}
                      disabled={saving === printer.id}
                    />
                    Active in scheduling
                  </label>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
              <p className="text-sm font-medium">Add printer</p>
              <input
                className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
                placeholder="Printer name"
                value={newPrinter.name}
                onChange={(e) => setNewPrinter((prev) => ({ ...prev, name: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select
                  className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1"
                  value={newPrinter.status}
                  onChange={(e) => setNewPrinter((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {PRINTER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1"
                  type="number"
                  min={0}
                  step={0.5}
                  value={newPrinter.dailyCapacityHours}
                  onChange={(e) => setNewPrinter((prev) => ({ ...prev, dailyCapacityHours: Number(e.target.value) }))}
                />
              </div>
              <button className="btn w-full text-sm" type="button" onClick={createPrinter} disabled={saving === 'new'}>
                Add printer
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Production queue</h2>
            <p className="text-xs text-slate-400">{snapshot.orders.length} active orders</p>
          </div>
          {snapshot.orders.length === 0 ? (
            <p className="text-sm text-slate-400">No active orders in the production queue.</p>
          ) : (
            <div className="space-y-3">
              {snapshot.orders.map((order) => (
                <div key={order.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        {order.orderNumber ? `MW-${order.orderNumber.toString().padStart(5, '0')}` : 'Draft order'}
                      </p>
                      <p className="font-medium">
                        {order.customerName || order.customerEmail || 'Customer order'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <OrderStatusBadge status={order.status} />
                      <span className={`text-[11px] uppercase tracking-wide ${order.orderWorksStatus === 'sent' ? 'text-emerald-300' : 'text-amber-300'}`}>
                        OrderWorks {order.orderWorksStatus || 'pending'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <button
                      type="button"
                      className="rounded-md border border-white/10 px-2 py-1 hover:border-white/30"
                      onClick={() => openComposer(order.id, 'request')}
                    >
                      Request changes
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-white/10 px-2 py-1 hover:border-white/30"
                      onClick={() => openComposer(order.id, 'message')}
                    >
                      Message customer
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-rose-400/40 px-2 py-1 text-rose-200 hover:border-rose-300/60 disabled:opacity-50"
                      onClick={() => deleteOrderFromSchedule(order)}
                      disabled={deletingOrderId === order.id}
                    >
                      {deletingOrderId === order.id ? 'Deleting...' : 'Delete job'}
                    </button>
                  </div>
                  {composer?.orderId === order.id ? (
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                      <p className="text-xs text-slate-400">
                        {composer.mode === 'request' ? 'Request customer approval' : 'Send a message'}
                      </p>
                      <textarea
                        className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-200"
                        rows={3}
                        placeholder={composer.mode === 'request' ? 'Describe what needs to change...' : 'Write a short update...'}
                        value={composerDraft}
                        onChange={(event) => setComposerDraft(event.target.value)}
                        disabled={composerSending}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-white/10 px-2 py-1 text-xs"
                          onClick={closeComposer}
                          disabled={composerSending}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-brand-500/60 bg-brand-500/20 px-2 py-1 text-xs text-white"
                          onClick={sendComposerMessage}
                          disabled={composerSending || !composerDraft.trim()}
                        >
                          {composerSending ? 'Sending...' : composer.mode === 'request' ? 'Send request' : 'Send message'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid sm:grid-cols-3 gap-3 mt-3 text-xs text-slate-300">
                    <div>
                      <p className="text-slate-500">Queue position</p>
                      <p className="text-sm font-medium">{order.queuePosition ?? '--'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Estimated print hours</p>
                      <p className="text-sm font-medium">{order.totalHours.toFixed(1)} hrs</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Projected completion</p>
                      <p className="text-sm font-medium">{order.estimatedCompletionAt ? formatDateTime(order.estimatedCompletionAt) : '--'}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>Printer: {order.printerName || 'Unassigned'}</span>
                    {order.failedAt ? <span className="text-rose-200">Failed</span> : null}
                  </div>
                  {order.orderWorksLastError ? (
                    <p className="mt-2 text-xs text-rose-200">OrderWorks error: {order.orderWorksLastError}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function QueueLane({
  title,
  subtitle,
  tone,
  orders,
}: {
  title: string
  subtitle: string
  tone: 'amber' | 'sky' | 'emerald' | 'rose'
  orders: OrderEntry[]
}) {
  const toneClass = tone === 'amber'
    ? 'border-amber-400/20 bg-amber-500/5'
    : tone === 'sky'
      ? 'border-sky-400/20 bg-sky-500/5'
      : tone === 'emerald'
        ? 'border-emerald-400/20 bg-emerald-500/5'
        : 'border-rose-400/20 bg-rose-500/5'

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${toneClass}`}>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
      {orders.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-xs text-slate-500">No orders in this lane.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <div key={`${title}-${order.id}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                  {order.orderNumber ? `MW-${order.orderNumber.toString().padStart(5, '0')}` : 'Draft'}
                </p>
                <span className="text-[11px] text-slate-400">#{order.queuePosition ?? '--'}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-white">{order.customerName || order.customerEmail || 'Customer order'}</p>
              <div className="mt-2 grid gap-1 text-xs text-slate-400">
                <span>Printer: {order.printerName || 'Unassigned'}</span>
                <span>{order.totalHours.toFixed(1)} hrs</span>
                <span>{order.estimatedCompletionAt ? formatDateTime(order.estimatedCompletionAt) : 'Unscheduled'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExceptionChip({ label, tone }: { label: string; tone: 'amber' | 'sky' | 'rose' }) {
  const toneClass = tone === 'amber'
    ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
    : tone === 'sky'
      ? 'border-sky-400/30 bg-sky-500/10 text-sky-200'
      : 'border-rose-400/30 bg-rose-500/10 text-rose-200'

  return <span className={`rounded-full border px-2 py-1 ${toneClass}`}>{label}</span>
}

function WatchCard({ title, value, detail }: { title: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{detail}</p>
    </div>
  )
}

function formatPrinterStatus(status: any) {
  if (!status) return 'unknown'
  if (status?.error) return `error: ${status.error}`
  const print = status?.job || status?.print || status?.printer?.print || status
  const rawState = print?.state || print?.gcode_state || print?.gcode_status || print?.status || ''
  const state = String(rawState || '').toLowerCase() || 'ready'
  const progress = typeof print?.progress_percent === 'number'
    ? print.progress_percent
    : typeof print?.progress === 'number'
      ? print.progress
    : typeof print?.percentage === 'number'
      ? print.percentage
      : typeof print?.percent === 'number'
        ? print.percent
        : null
  const progressLabel = typeof progress === 'number' ? ` (${Math.round(progress)}%)` : ''
  return `${state}${progressLabel}`
}
