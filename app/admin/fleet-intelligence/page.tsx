export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buildFleetIntelligence } from '@/lib/fleet-intelligence'
import FleetMaintenancePanel from '@/components/admin/FleetMaintenancePanel'

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

export default async function FleetIntelligencePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  const fleet = await buildFleetIntelligence(14)

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
                  <td className="py-2 pr-4 text-sm">{printer.name}</td>
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
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Reliability</div>
        <div className="grid md:grid-cols-2 gap-4">
          {fleet.map((printer) => (
            <div key={printer.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{printer.name}</div>
                  <div className="text-xs text-slate-400">Status: {printer.status}</div>
                </div>
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
          lastMaintenanceAt: printer.lastMaintenanceAt ? printer.lastMaintenanceAt.toISOString() : null,
          maintenanceIntervalHours: printer.maintenanceIntervalHours ?? null,
          maintenanceNotes: printer.maintenanceNotes ?? null,
        }))}
      />
    </div>
  )
}
