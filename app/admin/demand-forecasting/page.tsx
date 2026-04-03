export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getDemandForecast } from '@/lib/demand-forecasting'
import { formatCurrency } from '@/lib/currency'

export default async function DemandForecastingPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  const forecast = await getDemandForecast({ historyDays: 56, horizonDays: 30 })

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
