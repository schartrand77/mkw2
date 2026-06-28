import { prisma } from '@/lib/db'
import { serializeJob, type JobWithUser } from '@/app/api/admin/orderworks/jobs/_helpers'
import { formatCurrency } from '@/lib/currency'

export async function fetchAdminUsersWithBadges() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      createdAt: true,
      registrationSource: true,
      registrationIp: true,
      registrationUserAgent: true,
      lastLoginAt: true,
      lastLoginIp: true,
      lastLoginUserAgent: true,
      profile: { select: { slug: true, avatarImagePath: true } },
      badges: { include: { achievement: true } },
      discountPercent: true,
      isFriendsAndFamily: true,
      friendsAndFamilyPercent: true,
      isSuspended: true,
      isAdmin: true,
      role: true,
      _count: { select: { orders: true } },
    },
  })
}

type AdminUserWithBadges = Awaited<ReturnType<typeof fetchAdminUsersWithBadges>>[number]

export type AdminUserWithStats = AdminUserWithBadges & {
  orderCount: number
  totalSpentCents: number
}

export type AdminUsersSummary = {
  totalUsers: number
  verifiedUsers: number
  suspendedUsers: number
  adminUsers: number
  newUsers30d: number
  activeUsers30d: number
  customerOrders: number
  orderingUsers: number
  customerRevenueCents: number
  statCards: Array<{ label: string; value: number | string; hint: string }>
}

export type AdminUsersContract = {
  users: AdminUserWithStats[]
  summary: AdminUsersSummary
  query: { q: string }
}

function matchesAdminUserSearch(user: AdminUserWithStats, q: string) {
  if (!q) return true
  const haystack = [
    user.id,
    user.name,
    user.email,
    user.role,
    user.profile?.slug,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

export async function fetchAdminUsersContract(options: { q?: string | null } = {}): Promise<AdminUsersContract> {
  const q = (options.q || '').trim().toLowerCase()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

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

  const customerOrders = orderStats._count._all
  const customerRevenueCents = orderStats._sum.totalCents ?? 0
  const summary: AdminUsersSummary = {
    totalUsers,
    verifiedUsers,
    suspendedUsers,
    adminUsers,
    newUsers30d,
    activeUsers30d,
    customerOrders,
    orderingUsers: orderByUser.size,
    customerRevenueCents,
    statCards: [
      { label: 'Total users', value: totalUsers, hint: `${verifiedUsers} verified` },
      { label: 'Active (30d)', value: activeUsers30d, hint: `${newUsers30d} new signups` },
      { label: 'Admin/staff', value: adminUsers, hint: `${suspendedUsers} suspended` },
      { label: 'Customer orders', value: customerOrders, hint: `${orderByUser.size} ordering users` },
      {
        label: 'Customer revenue',
        value: formatCurrency(customerRevenueCents / 100),
        hint: 'All-time completed checkout records',
      },
    ],
  }

  return {
    users: usersWithStats.filter((user) => matchesAdminUserSearch(user, q)),
    summary,
    query: { q },
  }
}

export async function fetchJobQueueSnapshot(limit = 100) {
  const [jobs, pendingCount, totalCount] = await Promise.all([
    prisma.jobForm.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.jobForm.count({ where: { status: 'pending' } }),
    prisma.jobForm.count(),
  ])

  return {
    jobs: (jobs as JobWithUser[]).map(serializeJob),
    pendingCount,
    totalCount,
  }
}
