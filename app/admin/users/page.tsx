import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import Link from 'next/link'
import UsersAndBadgesPanel from '@/components/admin/UsersAndBadgesPanel'
import { fetchAdminUsersContract } from '@/lib/admin/queries'
import InviteUserForm from '@/components/admin/InviteUserForm'

export const dynamic = 'force-dynamic'

async function requireAdminServer() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) return null
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  return (user?.isAdmin || role === 'admin' || role === 'staff') ? payload.sub : null
}

type AdminUsersPageProps = {
  searchParams?: Promise<{ q?: string | string[] }>
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const adminId = await requireAdminServer()
  if (!adminId) return (<div className="text-slate-400">Forbidden</div>)
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const q = Array.isArray(resolvedSearchParams.q) ? resolvedSearchParams.q[0] : resolvedSearchParams.q

  const { users, summary } = await fetchAdminUsersContract({ q })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Link className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20" href="/admin">Back to Admin</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summary.statCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</div>
            <div className="mt-1 text-xs text-slate-400">{card.hint}</div>
          </div>
        ))}
      </div>
      <InviteUserForm />
      <div className="glass rounded-xl border border-white/10">
        <UsersAndBadgesPanel users={users as any} initialSearch={q || ''} />
      </div>
    </div>
  )
}
