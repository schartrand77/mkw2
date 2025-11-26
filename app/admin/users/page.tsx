import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import Link from 'next/link'
import UsersAndBadgesPanel from '@/components/admin/UsersAndBadgesPanel'
import { fetchAdminUsersWithBadges } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'

async function requireAdminServer() {
  const token = cookies().get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) return null
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } })
  return user?.isAdmin ? payload.sub : null
}

export default async function AdminUsersPage() {
  const adminId = await requireAdminServer()
  if (!adminId) return (<div className="text-slate-400">Forbidden</div>)

  const users = await fetchAdminUsersWithBadges()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users & Badges</h1>
        <Link className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20" href="/admin">Back to Admin</Link>
      </div>
      <div className="glass rounded-xl border border-white/10">
        <UsersAndBadgesPanel users={users} />
      </div>
    </div>
  )
}
