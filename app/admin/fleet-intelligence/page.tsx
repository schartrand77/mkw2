export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buildFleetIntelligence } from '@/lib/fleet-intelligence'
import { buildPredictiveDowntimeRisks } from '@/lib/predictive-ops'
import FleetMaintenancePanel from '@/components/admin/FleetMaintenancePanel'
import PrinterIdentity from '@/components/admin/PrinterIdentity'

function formatPct(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${Math.round(value * 100)}%`
}

function formatHours(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)}h`
}

function utilizationTone(utilization: number) {
  if (utilization >= 0.9) return 'bg-emerald-500/70'
  if (utilization >= 0.7) return 'bg-emerald-500/40'
  if (utilization >= 0.4) return 'bg-amber-500/40'
  if (utilization > 0) return 'bg-slate-600/40'
  return 'bg-white/5'
}

function riskTone(risk: 'low' | 'medium' | 'high' | 'critical') {
  if (risk === 'critical') return 'text-rose-300 border-rose-500/30 bg-rose-500/10'
  if (risk === 'high') return 'text-amber-200 border-amber-500/30 bg-amber-500/10'
  if (risk === 'medium') return 'text-sky-200 border-sky-500/30 bg-sky-500/10'
  return 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10'
}

export default async function FleetIntelligencePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  const [fleet, downtimeRisks] = await Promise.all([
    buildFleetIntelligence(14),
    buildPredictiveDowntimeRisks().catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Fleet Intelligence</h1>
          <p className="text-sm text-slate-400 mt-1">Utilization, success rate, and maintenance signals.</p>
        </div>
        <Link href="/admin" className="text-xs text-brand-300 underline">Back to admin</Link>
      </div>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-4">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Utilization heatmap (last 14 days)</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-slate-500 uppercase tracking-[0.2em]">
              <tr>
                <th className="text-left py-2">Printer</th>
                {fleet[0]?.utilization.map((cell) => (
                  <th key={cell.date} className="text-center py-2">{cell.date.slice(5)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fleet.map((printer) => (
                <tr key={printer.id} className="border-t border-white/10">
                  <td className="py-2 pr-4 text-sm">
                    <PrinterIdentity
                      name={printer.name}
                      provider={printer.provider}
                      externalId={printer.externalId}
                      metadata={printer.metadata}
                      status={printer.status}
                      active={printer.active}
                      lastSeenAt={printer.lastSeenAt}
                    />
                  </td>
                  {printer.utilization.map((cell) => (
                    <td key={`${printer.id}-${cell.date}`} className="py-2 text-center">
                      <div className={`h-6 w-6 rounded-md mx-auto ${utilizationTone(cell.utilization)}`} title={`${cell.hours.toFixed(1)}h / ${cell.capacity.toFixed(1)}h`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Downtime risk scoring</div>
            <p className="text-sm text-slate-400 mt-1">Combines reliability, heartbeat staleness, utilization, and maintenance drift.</p>
          </div>
          <div className="text-xs text-slate-500">{downtimeRisks.filter((entry) => ['critical', 'high'].includes(entry.risk)).length} printers need attention</div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {downtimeRisks.map((entry) => (
            <div key={entry.printerId} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{entry.printerName}</div>
                  <div className="text-xs text-slate-500">Risk score {Math.round(entry.score * 100)}%</div>
                </div>
                <div className={`inline-flex rounded-full border px-2 py-1 text-xs capitalize ${riskTone(entry.risk)}`}>{entry.risk}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
                <div>
                  <div className="text-slate-500">Utilization</div>
                  <div>{Math.round(entry.averageUtilization * 100)}%</div>
                </div>
                <div>
                  <div className="text-slate-500">Heartbeat</div>
                  <div>{entry.staleHours == null ? 'Live' : `${entry.staleHours.toFixed(1)}h stale`}</div>
                </div>
                <div>
                  <div className="text-slate-500">Maintenance</div>
                  <div>{entry.maintenanceOverdueHours == null ? 'On plan' : `${entry.maintenanceOverdueHours.toFixed(1)}h over`}</div>
                </div>
              </div>
              <div className="space-y-1">
                {entry.topSignals.slice(0, 3).map((signal) => (
                  <div key={`${entry.printerId}-${signal}`} className="text-xs text-slate-400">{signal}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-4">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Reliability</div>
        <div className="grid md:grid-cols-2 gap-4">
          {fleet.map((printer) => (
            <div key={printer.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between">
                <PrinterIdentity
                  name={printer.name}
                  provider={printer.provider}
                  externalId={printer.externalId}
                  metadata={printer.metadata}
                  status={printer.status}
                  active={printer.active}
                  lastSeenAt={printer.lastSeenAt}
                />
                <div className="text-xs text-slate-400">Success {formatPct(printer.successRate)}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-300 mt-3">
                <div>
                  <div className="text-slate-500">Completed</div>
                  <div className="text-sm font-semibold">{printer.completed}</div>
                </div>
                <div>
                  <div className="text-slate-500">Failures</div>
                  <div className="text-sm font-semibold">{printer.failures}</div>
                </div>
                <div>
                  <div className="text-slate-500">MTBF</div>
                  <div className="text-sm font-semibold">{formatHours(printer.mtbfHours)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <FleetMaintenancePanel
        printers={fleet.map((printer) => ({
          id: printer.id,
          name: printer.name,
          provider: printer.provider,
          externalId: printer.externalId,
          metadata: printer.metadata,
          status: printer.status,
          active: printer.active,
          lastSeenAt: printer.lastSeenAt ? printer.lastSeenAt.toISOString() : null,
          lastMaintenanceAt: printer.lastMaintenanceAt ? printer.lastMaintenanceAt.toISOString() : null,
          maintenanceIntervalHours: printer.maintenanceIntervalHours ?? null,
          maintenanceNotes: printer.maintenanceNotes ?? null,
        }))}
      />
    </div>
  )
}
