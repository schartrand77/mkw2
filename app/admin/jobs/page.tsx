import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import PrintLabJobQueue from '@/components/admin/PrintLabJobQueue'
import { buildProductionQueueClientSnapshot, getProductionSnapshot } from '@/lib/production'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'PrintLab Job Queue',
}

type AdminJobsPageProps = {
  searchParams?: Promise<{ q?: string | string[] }>
}

export default async function AdminJobsPage({ searchParams }: AdminJobsPageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  const snapshot = buildProductionQueueClientSnapshot(await getProductionSnapshot({ includeCustomer: true }))
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const q = Array.isArray(resolvedSearchParams.q) ? resolvedSearchParams.q[0] : resolvedSearchParams.q

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-brand-400 uppercase tracking-[0.3em]">PrintLab</p>
          <h1 className="text-3xl font-semibold">Job queue</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor current production jobs, PrintLab handoff state, and queue progress.
          </p>
        </div>
        <Link href="/admin" className="px-3 py-1.5 rounded-md border border-white/10 text-sm hover:border-white/20">
          Back to dashboard
        </Link>
      </div>
      <div className="glass rounded-xl border border-white/10 p-6">
        <PrintLabJobQueue initialSnapshot={snapshot} initialSearch={q || ''} />
      </div>
    </div>
  )
}
