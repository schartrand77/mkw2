'use client'

import { useMemo, useState } from 'react'
import type { AnalyticsSnapshot } from '@/lib/admin/analytics'
import { formatCurrency } from '@/lib/currency'

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

export default function AnalyticsDashboard({ initial }: { initial: AnalyticsSnapshot }) {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>(initial)
  const [days, setDays] = useState<number>(initial.range.days)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async (nextDays = days) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/analytics?days=${nextDays}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load analytics')
      setSnapshot(data)
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const profitRows = useMemo(() => snapshot.profitPerJob.slice(0, 15), [snapshot.profitPerJob])
  const utilizationDays = snapshot.utilization.days
  const utilizationPeak = utilizationDays.reduce((max, day) => Math.max(max, day.utilizationPct), 0) || 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Analytics & Insight</h1>
          <p className="text-sm text-slate-400 mt-1">
            Estimated metrics based on recorded orders and pricing profiles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
            value={days}
            onChange={(event) => {
              const nextDays = Number(event.target.value)
              setDays(nextDays)
              refresh(nextDays)
            }}
            disabled={loading}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button className="btn btn-outline text-sm" type="button" onClick={() => refresh()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-6 gap-4">
        <SummaryCard
          label="Revenue"
          value={formatCents(snapshot.summary.revenueCents)}
          helper={`${snapshot.summary.orders} orders`}
        />
        <SummaryCard
          label="Estimated cost"
          value={formatCents(snapshot.summary.estimatedCostCents)}
          helper={`${snapshot.summary.estimatedHours.toFixed(1)} hrs`}
        />
        <SummaryCard
          label="Estimated profit"
          value={formatCents(snapshot.summary.estimatedProfitCents)}
          helper="Gross estimate"
        />
        <SummaryCard
          label="Profit per printer hour"
          value={snapshot.summary.profitPerHour != null ? formatCurrency(snapshot.summary.profitPerHour) : '--'}
          helper="Based on estimated hours"
        />
        <SummaryCard
          label="Utilization"
          value={snapshot.summary.utilizationPct != null ? `${snapshot.summary.utilizationPct.toFixed(1)}%` : '--'}
          helper={`${snapshot.utilization.capacityHoursPerDay.toFixed(1)} hrs/day capacity`}
        />
        <SummaryCard
          label="Coverage"
          value={`${averageCoverage(snapshot.profitPerJob)}%`}
          helper="Items w/ volume data"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Utilization trend</h2>
            <span className="text-xs text-slate-400">{snapshot.range.days} days</span>
          </div>
          <div className="h-32 flex items-end gap-1">
            {utilizationDays.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full rounded-sm bg-brand-500/60"
                  style={{ height: `${(day.utilizationPct / utilizationPeak) * 100}%` }}
                  title={`${day.date}: ${day.hours.toFixed(1)} hrs (${day.utilizationPct.toFixed(1)}%)`}
                />
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-400">
            Peaks at {utilizationPeak.toFixed(1)}% of daily capacity.
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Revenue by material</h2>
            <span className="text-xs text-slate-400">Top {snapshot.revenueByMaterial.length}</span>
          </div>
          <div className="space-y-3">
            {snapshot.revenueByMaterial.map((row) => (
              <div key={row.material} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{row.material}</span>
                  <span className="text-slate-300">{formatCents(row.revenueCents)}</span>
                </div>
                <div className="h-1.5 rounded bg-white/10">
                  <div
                    className="h-full rounded bg-emerald-400/70"
                    style={{ width: `${Math.max(2, (row.revenueCents / maxRevenue(snapshot.revenueByMaterial)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {snapshot.revenueByMaterial.length === 0 ? (
              <p className="text-sm text-slate-400">No revenue recorded for this range.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Profit per job</h2>
            <span className="text-xs text-slate-400">Most recent</span>
          </div>
          <div className="space-y-2">
            {profitRows.map((row) => (
              <div key={row.id} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {row.orderNumber ? `MW-${row.orderNumber.toString().padStart(5, '0')}` : 'Draft order'}
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(row.createdAt)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-100">{formatCents(row.estimatedProfitCents)}</span>
                  <span className="text-xs text-slate-400">{row.estimatedHours.toFixed(1)} hrs</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>Revenue {formatCents(row.revenueCents)}</span>
                  <span>Cost {formatCents(row.estimatedCostCents)}</span>
                  <span>Coverage {row.coveragePct}%</span>
                </div>
              </div>
            ))}
            {profitRows.length === 0 ? (
              <p className="text-sm text-slate-400">No orders in this range.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Failure rate</h2>
            <span className="text-xs text-slate-400">Model & material</span>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">By material</p>
              <div className="mt-2 space-y-2">
                {snapshot.failureRateByMaterial.slice(0, 6).map((row) => (
                  <div key={row.material} className="flex items-center justify-between text-sm">
                    <span>{row.material}</span>
                    <span className="text-slate-300">{(row.failureRate * 100).toFixed(1)}%</span>
                  </div>
                ))}
                {snapshot.failureRateByMaterial.length === 0 ? (
                  <p className="text-sm text-slate-400">No failure data yet.</p>
                ) : null}
              </div>
            </div>
            <div className="border-t border-white/10 pt-3">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">By model</p>
              <div className="mt-2 space-y-2">
                {snapshot.failureRateByModel.slice(0, 6).map((row) => (
                  <div key={row.modelId} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[200px]">{row.modelTitle}</span>
                    <span className="text-slate-300">{(row.failureRate * 100).toFixed(1)}%</span>
                  </div>
                ))}
                {snapshot.failureRateByModel.length === 0 ? (
                  <p className="text-sm text-slate-400">No failure data yet.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-2">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-slate-400">{helper}</p>
    </div>
  )
}

function formatCents(amountCents: number): string {
  return formatCurrency(amountCents / 100)
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
}

function maxRevenue(rows: { revenueCents: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.revenueCents), 1)
}

function averageCoverage(rows: { coveragePct: number }[]): number {
  if (rows.length === 0) return 0
  const total = rows.reduce((sum, row) => sum + row.coveragePct, 0)
  return Math.round(total / rows.length)
}
