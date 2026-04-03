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

export async function fetchPrintLabJobQueueSnapshot(limit = 100) {
  const [jobs, totalCount, failedCount] = await Promise.all([
    prisma.printLabJob.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        orderId: true,
        orderItemId: true,
        sourceJobId: true,
        printLabJobId: true,
        status: true,
        printerId: true,
        printerName: true,
        queueItemId: true,
        modelId: true,
        modelName: true,
        fileName: true,
        filePath: true,
        lastSubmittedAt: true,
        lastCallbackAt: true,
        startedAt: true,
        completedAt: true,
        submitAttempts: true,
        callbackCount: true,
        lastError: true,
        metadata: true,
        history: true,
        createdAt: true,
        updatedAt: true,
        order: {
          select: {
            orderNumber: true,
            customerEmail: true,
            customerName: true,
          },
        },
      },
    }),
    prisma.printLabJob.count(),
    prisma.printLabJob.count({ where: { status: { in: ['failed', 'submit_failed'] } } }),
  ])

  return {
    jobs,
    totalCount,
    failedCount,
  }
}
