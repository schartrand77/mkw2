'use client'

import { useState } from 'react'
import type { ReleaseHealthSnapshot } from '@/lib/observability-health'

type Props = {
  initial: ReleaseHealthSnapshot
}

export default function ReleaseHealthDashboard({ initial }: Props) {
  const [snapshot, setSnapshot] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/metrics', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load release health')
      setSnapshot(data.releaseHealth)
    } catch (err: any) {
      setError(err?.message || 'Failed to load release health')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Release Health</h1>
          <p className="mt-1 text-sm text-slate-400">
            Live SLO and dependency view for checkout, callbacks, and queue pressure.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={snapshot.status} label={snapshot.status.toUpperCase()} />
          <button className="btn btn-outline text-sm" type="button" onClick={refresh} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Overall status" value={snapshot.status.toUpperCase()} helper={formatTimestamp(snapshot.generatedAt)} status={snapshot.status} />
        <SummaryCard label="SLOs tracked" value={String(snapshot.slos.length)} helper="Checkout, callbacks, queue" />
        <SummaryCard label="Alerts" value={String(snapshot.alerts.length)} helper="Warn/fail threshold breaches" />
        <SummaryCard
          label="Dependencies"
          value={`${snapshot.dependencies.summary.passing}/${snapshot.dependencies.summary.total}`}
          helper={`${snapshot.dependencies.summary.failing} fail, ${snapshot.dependencies.summary.warning} warn`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {snapshot.slos.map((slo) => (
          <div key={slo.key} className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{slo.label}</h2>
                <p className="mt-1 text-sm text-slate-400">{slo.summary}</p>
              </div>
              <StatusPill status={slo.status} label={slo.status.toUpperCase()} />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs uppercase tracking-[0.24em] text-slate-500">
              Target: {slo.target}
            </div>
            <div className="space-y-2">
              {Object.entries(slo.metrics).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-400">{formatMetricKey(key)}</span>
                  <span className="font-medium text-slate-100">{formatMetricValue(value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Release alerts</h2>
            <span className="text-xs text-slate-500">{snapshot.alerts.length} active</span>
          </div>
          <div className="space-y-2">
            {snapshot.alerts.length === 0 ? (
              <p className="text-sm text-emerald-300">No active release-health alerts.</p>
            ) : snapshot.alerts.map((alert, index) => (
              <div key={`${alert.area}-${index}`} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-100">{alert.area}</span>
                  <StatusPill status={alert.severity} label={alert.severity.toUpperCase()} />
                </div>
                <p className="mt-2 text-sm text-slate-300">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Dependency checks</h2>
            <span className="text-xs text-slate-500">{formatTimestamp(snapshot.generatedAt)}</span>
          </div>
          <div className="space-y-2">
            {snapshot.dependencies.checks.map((check) => (
              <div key={check.name} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-100">{check.name}</span>
                  <StatusPill status={normalizeDependencyStatus(check.status)} label={check.status.toUpperCase()} />
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {check.detail || 'No detail'}{typeof check.latencyMs === 'number' ? ` · ${Math.round(check.latencyMs)} ms` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function normalizeDependencyStatus(status: 'ok' | 'warn' | 'fail' | 'skipped'): 'ok' | 'warn' | 'fail' {
  if (status === 'fail') return 'fail'
  if (status === 'warn' || status === 'skipped') return 'warn'
  return 'ok'
}

function formatMetricKey(value: string) {
  return value
    .replace(/Pct$/, ' %')
    .replace(/Ms$/, ' ms')
    .replace(/Sec$/, ' sec')
    .replace(/Hours$/, ' hours')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (match) => match.toUpperCase())
}

function formatMetricValue(value: number | string | null) {
  if (value == null) return '--'
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return '--'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(2)
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function StatusPill({ status, label }: { status: 'ok' | 'warn' | 'fail'; label: string }) {
  const classes = status === 'ok'
    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
    : status === 'warn'
      ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
      : 'border-rose-400/30 bg-rose-500/10 text-rose-200'
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium tracking-[0.2em] ${classes}`}>
      {label}
    </span>
  )
}

function SummaryCard({
  label,
  value,
  helper,
  status,
}: {
  label: string
  value: string
  helper: string
  status?: 'ok' | 'warn' | 'fail'
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</p>
        {status ? <StatusPill status={status} label={status.toUpperCase()} /> : null}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-slate-400">{helper}</p>
    </div>
  )
}
