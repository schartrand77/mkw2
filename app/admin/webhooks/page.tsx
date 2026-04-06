export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { buildWebhookPortalSnapshot, getWebhookDocSections } from '@/lib/webhook-operations'

function tone(status: 'ok' | 'warn') {
  return status === 'ok'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
}

export default async function AdminWebhooksPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  const snapshot = buildWebhookPortalSnapshot()
  const docs = getWebhookDocSections()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Webhook & API Ops</h1>
          <p className="mt-1 text-sm text-slate-400">Security posture, callback contracts, and operator guidance for inbound integrations.</p>
        </div>
        <Link href="/admin" className="text-xs text-brand-300 underline">Back to admin</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Endpoints</div>
          <div className="mt-2 text-2xl font-semibold">{snapshot.summary.total}</div>
          <div className="text-xs text-slate-400">Inbound routes under governance</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Secrets configured</div>
          <div className="mt-2 text-2xl font-semibold">{snapshot.summary.configured}</div>
          <div className="text-xs text-slate-400">Routes with at least one valid secret source</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Warnings</div>
          <div className="mt-2 text-2xl font-semibold">{snapshot.summary.warnings}</div>
          <div className="text-xs text-slate-400">Remaining compatibility or config concerns</div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Endpoint posture</h2>
          <p className="text-sm text-slate-400 mt-1">Current auth mode support, fallback paths, and secret coverage.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {snapshot.endpoints.map((endpoint) => (
            <div key={endpoint.id} className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{endpoint.label}</div>
                  <div className="text-xs text-slate-500 mt-1">{endpoint.path}</div>
                </div>
                <div className={`inline-flex rounded-full border px-2 py-1 text-xs uppercase tracking-[0.2em] ${tone(endpoint.risk)}`}>
                  {endpoint.risk}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div>
                  <div className="text-slate-500">Auth modes</div>
                  <div>{endpoint.authModes.join(' + ')}</div>
                </div>
                <div>
                  <div className="text-slate-500">Replay window</div>
                  <div>{endpoint.replayToleranceMinutes} min</div>
                </div>
                <div>
                  <div className="text-slate-500">Secret keys</div>
                  <div>{endpoint.secretEnvKeys.join(', ')}</div>
                </div>
                <div>
                  <div className="text-slate-500">Query fallback</div>
                  <div>{endpoint.querySecretEnabled ? 'Enabled' : 'Disabled'}</div>
                </div>
              </div>
              <div className={`rounded-lg border px-3 py-2 text-xs ${endpoint.secretConfigured ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200' : 'border-rose-500/20 bg-rose-500/5 text-rose-200'}`}>
                {endpoint.secretConfigured ? 'Secret configured' : 'Secret missing'}
              </div>
              <div className="space-y-1">
                {endpoint.notes.map((note) => (
                  <div key={`${endpoint.id}-${note}`} className="text-xs text-slate-400">{note}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Operator docs</h2>
            <p className="text-sm text-slate-400 mt-1">Security model and callback handling guidance surfaced inside admin.</p>
          </div>
          <div className="text-xs text-slate-500">Repo reference: `docs/wiki/Webhook-Operations.md`</div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {docs.map((section) => (
            <div key={section.id} className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold">{section.title}</div>
                <div className="text-xs text-slate-400 mt-1">{section.body}</div>
              </div>
              <div className="space-y-1">
                {section.bullets.map((bullet) => (
                  <div key={`${section.id}-${bullet}`} className="text-xs text-slate-300">{bullet}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
