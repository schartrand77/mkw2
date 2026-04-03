export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buildWasteReport, buildColorSimilaritySuggestions, buildAlternateMaterialSuggestions } from '@/lib/material-optimization'

export default async function MaterialOptimizationPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  const [wasteReport, colorSuggestions, alternateMaterials] = await Promise.all([
    buildWasteReport(30).catch(() => []),
    buildColorSimilaritySuggestions().catch(() => []),
    buildAlternateMaterialSuggestions().catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Material Optimization</h1>
          <p className="text-sm text-slate-400 mt-1">Reduce waste, suggest alternatives, and keep colors consistent.</p>
        </div>
        <Link href="/admin" className="text-xs text-brand-300 underline">Back to admin</Link>
      </div>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Waste report (last 30 days)</div>
        {wasteReport.length === 0 ? (
          <p className="text-sm text-slate-400">No waste data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="text-left py-2">Material</th>
                  <th className="text-right py-2">Estimated (g)</th>
                  <th className="text-right py-2">Actual (g)</th>
                  <th className="text-right py-2">Variance (g)</th>
                  <th className="text-right py-2">Orders w/ slicer</th>
                </tr>
              </thead>
              <tbody>
                {wasteReport.map((row) => (
                  <tr key={row.material} className="border-t border-white/10">
                    <td className="py-2">{row.material}</td>
                    <td className="py-2 text-right">{row.estimatedGrams.toFixed(1)}</td>
                    <td className="py-2 text-right">{row.actualGrams.toFixed(1)}</td>
                    <td className={`py-2 text-right ${row.varianceGrams > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {row.varianceGrams.toFixed(1)}
                    </td>
                    <td className="py-2 text-right">{row.coverageOrders}/{row.totalOrders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Color similarity suggestions</div>
        {colorSuggestions.length === 0 ? (
          <p className="text-sm text-slate-400">No color similarity data available.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {colorSuggestions.map((entry, idx) => (
              <div key={`${entry.material}-${entry.target.name}-${idx}`} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{entry.material}</div>
                <div className="text-sm font-semibold mt-1">{entry.target.name}</div>
                <div className="text-xs text-slate-400 mt-2">Closest in-stock alternatives:</div>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {entry.alternatives.map((alt) => (
                    <span key={`${entry.material}-${entry.target.name}-${alt.name}`} className="rounded-full border border-white/10 px-2 py-0.5">
                      {alt.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Alternate filament recommendations</div>
        {alternateMaterials.length === 0 ? (
          <p className="text-sm text-slate-400">All materials have stock or StockWorks is not configured.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {alternateMaterials.map((entry) => (
              <div key={entry.material} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm font-semibold">{entry.material} is depleted</div>
                <div className="text-xs text-slate-400 mt-2">Suggested alternatives in stock:</div>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {entry.availableAlternates.map((alt) => (
                    <span key={`${entry.material}-${alt.material}`} className="rounded-full border border-white/10 px-2 py-0.5">
                      {alt.material} · {alt.grams.toFixed(0)} g
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
