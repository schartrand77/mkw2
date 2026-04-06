export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getDemandForecast } from '@/lib/demand-forecasting'
import { formatCurrency } from '@/lib/currency'
import { buildPredictiveSlaWarnings } from '@/lib/predictive-ops'

function riskTone(risk: 'low' | 'medium' | 'high' | 'critical') {
  if (risk === 'critical') return 'text-rose-300 border-rose-500/30 bg-rose-500/10'
  if (risk === 'high') return 'text-amber-200 border-amber-500/30 bg-amber-500/10'
  if (risk === 'medium') return 'text-sky-200 border-sky-500/30 bg-sky-500/10'
  return 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10'
}

export default async function DemandForecastingPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  const [forecast, sla] = await Promise.all([
    getDemandForecast({ historyDays: 56, horizonDays: 30 }),
    buildPredictiveSlaWarnings().catch(() => ({
      warnings: [],
      summary: {
        queueHours: 0,
        queueDays: null,
        projectedBacklogDays: null,
        incomingOrdersNext7Days: 0,
        incomingHoursNext7Days: 0,
        atRiskOrders: 0,
      },
    })),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Demand Forecasting</h1>
          <p className="text-sm text-slate-400 mt-1">
            Forecasts based on recent order volume and day-of-week patterns.
          </p>
        </div>
        <Link href="/admin" className="text-xs text-brand-300 underline">Back to admin</Link>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Avg orders/day</p>
          <p className="text-2xl font-semibold">{forecast.summary.averageOrdersPerDay.toFixed(1)}</p>
          <p className="text-xs text-slate-400">Last {forecast.range.historyDays} days</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Avg revenue/day</p>
          <p className="text-2xl font-semibold">{formatCurrency(forecast.summary.averageRevenuePerDayCents / 100)}</p>
          <p className="text-xs text-slate-400">Last {forecast.range.historyDays} days</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Forecast horizon</p>
          <p className="text-2xl font-semibold">{forecast.range.horizonDays} days</p>
          <p className="text-xs text-slate-400">Day-of-week trend</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">SLA early warnings</h2>
            <p className="text-sm text-slate-400 mt-1">Queue pressure, ETA confidence, and intake forecast rolled into at-risk order warnings.</p>
          </div>
          <div className="text-xs text-slate-500">{sla.summary.atRiskOrders} at-risk queued orders</div>
        </div>
        <div className="grid md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Queue hours</div>
            <div className="text-xl font-semibold mt-1">{sla.summary.queueHours.toFixed(1)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Queue days</div>
            <div className="text-xl font-semibold mt-1">{sla.summary.queueDays == null ? 'N/A' : sla.summary.queueDays.toFixed(1)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Projected backlog</div>
            <div className="text-xl font-semibold mt-1">{sla.summary.projectedBacklogDays == null ? 'N/A' : `${sla.summary.projectedBacklogDays.toFixed(1)}d`}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Incoming next 7d</div>
            <div className="text-xl font-semibold mt-1">{sla.summary.incomingOrdersNext7Days.toFixed(1)}</div>
          </div>
        </div>
        {sla.warnings.length === 0 ? (
          <p className="text-sm text-slate-400">No queued orders are currently above the SLA warning threshold.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {sla.warnings.slice(0, 6).map((warning) => (
              <div key={warning.orderId} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      {warning.orderNumber ? `MW-${String(warning.orderNumber).padStart(5, '0')}` : warning.orderId}
                    </div>
                    <div className="text-xs text-slate-500 capitalize">{warning.status.replaceAll('_', ' ')}</div>
                  </div>
                  <div className={`inline-flex rounded-full border px-2 py-1 text-xs capitalize ${riskTone(warning.risk)}`}>{warning.risk}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
                  <div>
                    <div className="text-slate-500">Queue pos</div>
                    <div>{warning.queuePosition ?? 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">ETA confidence</div>
                    <div>{warning.etaConfidenceScore == null ? 'N/A' : `${Math.round(warning.etaConfidenceScore * 100)}%`}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Risk score</div>
                    <div>{Math.round(warning.score * 100)}%</div>
                  </div>
                </div>
                <div className="space-y-1">
                  {warning.reasons.slice(0, 3).map((reason) => (
                    <div key={`${warning.orderId}-${reason}`} className="text-xs text-slate-400">{reason}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">30-day forecast</h2>
          <span className="text-xs text-slate-400">{forecast.forecast.length} days</span>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {forecast.forecast.map((day) => (
            <div key={day.date} className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">{day.date}</span>
                <span className={`text-xs ${
                  day.confidence === 'high'
                    ? 'text-emerald-300'
                    : day.confidence === 'medium'
                      ? 'text-amber-300'
                      : 'text-slate-400'
                }`}>
                  {day.confidence} confidence
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>{day.expectedOrders.toFixed(1)} orders</span>
                <span>{formatCurrency(day.expectedRevenueCents / 100)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
