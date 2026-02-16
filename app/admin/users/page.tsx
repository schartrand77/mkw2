import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import Link from 'next/link'
import UsersAndBadgesPanel from '@/components/admin/UsersAndBadgesPanel'
import { fetchAdminUsersWithBadges } from '@/lib/admin/queries'
import InviteUserForm from '@/components/admin/InviteUserForm'
import { formatCurrency } from '@/lib/currency'

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

export default async function AdminUsersPage() {
  const adminId = await requireAdminServer()
  if (!adminId) return (<div className="text-slate-400">Forbidden</div>)

  const now = new Date()
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS)

  const [users, totalUsers, verifiedUsers, suspendedUsers, adminUsers, newUsers30d, activeUsers30d, userOrderAgg, orderStats] = await Promise.all([
    fetchAdminUsersWithBadges(),
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { isSuspended: true } }),
    prisma.user.count({ where: { OR: [{ isAdmin: true }, { role: { in: ['admin', 'staff'] } }] } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: thirtyDaysAgo } } }),
    prisma.printOrder.groupBy({
      by: ['userId'],
      where: { userId: { not: null } },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    prisma.printOrder.aggregate({
      where: { userId: { not: null } },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
  ])

  const orderByUser = new Map<string, { count: number; totalCents: number }>()
  for (const row of userOrderAgg) {
    if (!row.userId) continue
    orderByUser.set(row.userId, {
      count: row._count._all,
      totalCents: row._sum.totalCents ?? 0,
    })
  }
  const usersWithStats = users.map((user) => {
    const order = orderByUser.get(user.id)
    return {
      ...user,
      orderCount: order?.count ?? 0,
      totalSpentCents: order?.totalCents ?? 0,
    }
  })

  const statCards = [
    { label: 'Total users', value: totalUsers, hint: `${verifiedUsers} verified` },
    { label: 'Active (30d)', value: activeUsers30d, hint: `${newUsers30d} new signups` },
    { label: 'Admin/staff', value: adminUsers, hint: `${suspendedUsers} suspended` },
    {
      label: 'Customer orders',
      value: orderStats._count._all,
      hint: `${orderByUser.size} ordering users`,
    },
    {
      label: 'Customer revenue',
      value: formatCurrency((orderStats._sum.totalCents ?? 0) / 100),
      hint: 'All-time completed checkout records',
    },
  ] as const

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Link className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20" href="/admin">Back to Admin</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</div>
            <div className="mt-1 text-xs text-slate-400">{card.hint}</div>
          </div>
        ))}
      </div>
      <InviteUserForm />
      <div className="glass rounded-xl border border-white/10">
        <UsersAndBadgesPanel users={usersWithStats as any} />
      </div>
    </div>
  )
}
