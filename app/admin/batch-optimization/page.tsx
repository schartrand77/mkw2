export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buildBatchGroups, buildNestingSuggestions, buildPrintClusterPlan } from '@/lib/batch-optimization'

export default async function BatchOptimizationPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  const [{ groups, optimizedQueue }, nestingSuggestions, clusterPlan] = await Promise.all([
    buildBatchGroups(),
    buildNestingSuggestions(6, 6).catch(() => []),
    buildPrintClusterPlan().catch(() => ({ clusters: [], utilization: 0, activePrinters: [] })),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Batch Optimization</h1>
          <p className="text-sm text-slate-400 mt-1">Group jobs by material and color to reduce swaps.</p>
        </div>
        <Link href="/admin" className="text-xs text-brand-300 underline">Back to admin</Link>
      </div>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Suggested batches</div>
        {groups.length === 0 ? (
          <p className="text-sm text-slate-400">No active orders available for batching.</p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {groups.map((group) => (
              <div key={group.key} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{group.material}</div>
                  <div className="text-xs text-slate-400">{group.orders.length} orders</div>
                </div>
                <div className="text-xs text-slate-400">
                  Colors: {group.colors.length ? group.colors.join(', ') : 'No color specified'}
                </div>
                <div className="text-xs text-slate-400">Total hours: {group.totalHours.toFixed(1)}h</div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                  {group.orders.map((order) => (
                    <span key={order.id} className="rounded-full border border-white/10 px-2 py-0.5">
                      {order.orderNumber ? `MW-${String(order.orderNumber).padStart(5, '0')}` : 'Draft'} · {order.totalHours.toFixed(1)}h
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Queue optimizer</div>
        {optimizedQueue.length === 0 ? (
          <p className="text-sm text-slate-400">No optimized queue suggestions yet.</p>
        ) : (
          <div className="space-y-2">
            {optimizedQueue.map((order, idx) => (
              <div key={order.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    {idx + 1}. {order.orderNumber ? `MW-${String(order.orderNumber).padStart(5, '0')}` : 'Draft order'}
                  </div>
                  <div className="text-xs text-slate-400">{order.totalHours.toFixed(1)}h</div>
                </div>
                <div className="text-xs text-slate-500">Status: {order.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Auto nesting suggestions</div>
        <p className="text-xs text-slate-500">
          Batches are grouped by material + color, targeting ~6h per plate (max 6 items). Adjust in code as needed.
        </p>
        {nestingSuggestions.length === 0 ? (
          <p className="text-sm text-slate-400">No nesting suggestions available.</p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {nestingSuggestions.map((group) => (
              <div key={`nest-${group.key}`} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{group.material}</div>
                  <div className="text-xs text-slate-400">{group.batches.length} plates</div>
                </div>
                <div className="text-xs text-slate-400">
                  Colors: {group.colors.length ? group.colors.join(', ') : 'No color specified'}
                </div>
                <div className="space-y-2 text-xs">
                  {group.batches.map((batch, idx) => (
                    <div key={`${group.key}-batch-${idx}`} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Plate {idx + 1}</span>
                        <span className="text-slate-400">{batch.totalHours.toFixed(1)}h</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {batch.orders.map((order) => (
                          <span key={order.id} className="rounded-full border border-white/10 px-2 py-0.5">
                            {order.orderNumber ? `MW-${String(order.orderNumber).padStart(5, '0')}` : 'Draft'} · {order.totalHours.toFixed(1)}h
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Print cluster planning</div>
        <p className="text-xs text-slate-500">Assign material/color batches to printers based on capacity.</p>
        {clusterPlan.activePrinters.length === 0 ? (
          <p className="text-sm text-slate-400">No active printers available.</p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {clusterPlan.activePrinters.map((printer) => (
              <div key={printer.id} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{printer.name}</div>
                  <div className="text-xs text-slate-400">{printer.loadHours.toFixed(1)}h load</div>
                </div>
                <div className="text-xs text-slate-400">Capacity: {printer.dailyCapacityHours.toFixed(1)}h/day</div>
                <div className="text-xs text-slate-400">Utilization: {printer.dailyCapacityHours > 0 ? Math.round((printer.loadHours / printer.dailyCapacityHours) * 100) : 0}%</div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-300 mt-2">
                  {clusterPlan.clusters
                    .filter((cluster) => cluster.printerId === printer.id)
                    .map((cluster, idx) => (
                      <span key={`${printer.id}-${cluster.material}-${idx}`} className="rounded-full border border-white/10 px-2 py-0.5">
                        {cluster.material} · {cluster.colors.length ? cluster.colors.join(', ') : 'No color'}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {clusterPlan.clusters.length > 0 && (
          <div className="space-y-2">
            {clusterPlan.clusters.map((cluster, idx) => (
              <div key={`${cluster.material}-${cluster.printerName}-${idx}`} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{cluster.material} · {cluster.colors.length ? cluster.colors.join(', ') : 'No color'}</div>
                  <div className="text-xs text-slate-400">{cluster.totalHours.toFixed(1)}h</div>
                </div>
                <div className="text-xs text-slate-500">Assigned: {cluster.printerName}</div>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-300">
                  {cluster.jobs.map((job) => (
                    <span key={job.id} className="rounded-full border border-white/10 px-2 py-0.5">
                      {job.orderNumber ? `MW-${String(job.orderNumber).padStart(5, '0')}` : 'Draft'} · {job.totalHours.toFixed(1)}h
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
