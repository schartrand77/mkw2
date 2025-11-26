import { prisma } from '@/lib/db'
import { serializeJob, type JobWithUser } from '@/app/api/admin/orderworks/jobs/_helpers'

export async function fetchAdminUsersWithBadges() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      createdAt: true,
      profile: { select: { slug: true } },
      badges: { include: { achievement: true } },
      discountPercent: true,
      isFriendsAndFamily: true,
      friendsAndFamilyPercent: true,
      isSuspended: true,
      isAdmin: true,
    },
  })
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
