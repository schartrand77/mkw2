import { prisma } from '@/lib/db'
import { normalizeOrderStatus } from '@/lib/order-status'

export type CreatorQualitySnapshot = {
  score: number
  tier: 'Elite' | 'Proven' | 'Rising' | 'New'
  summary: string
  modelCount: number
  totalDownloads: number
  successfulPrints: number
  totalPrints: number
  failureRate: number
  completionRate: number
  verifiedReviewCount: number
  badgeCount: number
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function resolveTier(score: number): CreatorQualitySnapshot['tier'] {
  if (score >= 85) return 'Elite'
  if (score >= 70) return 'Proven'
  if (score >= 55) return 'Rising'
  return 'New'
}

export async function getCreatorQualitySnapshot(userId: string): Promise<CreatorQualitySnapshot> {
  const [models, badgeCount] = await Promise.all([
    prisma.model.findMany({
      where: { userId },
      select: { id: true, downloads: true },
    }),
    prisma.userAchievement.count({ where: { userId } }),
  ])

  const modelIds = models.map((model) => model.id)
  const totalDownloads = models.reduce((sum, model) => sum + Math.max(0, model.downloads || 0), 0)

  if (modelIds.length === 0) {
    return {
      score: 25,
      tier: 'New',
      summary: 'New creator profile. Quality score will strengthen as prints, downloads, and verified feedback accumulate.',
      modelCount: 0,
      totalDownloads,
      successfulPrints: 0,
      totalPrints: 0,
      failureRate: 0,
      completionRate: 0,
      verifiedReviewCount: 0,
      badgeCount,
    }
  }

  const [orderItems, comments, downloads] = await Promise.all([
    prisma.printOrderItem.findMany({
      where: { modelId: { in: modelIds } },
      select: {
        modelId: true,
        quantity: true,
        order: { select: { status: true, failedAt: true } },
      },
    }),
    prisma.modelComment.findMany({
      where: { modelId: { in: modelIds } },
      select: { modelId: true, userId: true },
    }),
    prisma.modelDownload.findMany({
      where: { modelId: { in: modelIds } },
      select: { modelId: true, userId: true },
    }),
  ])

  let totalPrints = 0
  let failedPrints = 0
  let completedPrints = 0
  for (const item of orderItems) {
    const qty = Math.max(0, item.quantity || 0)
    totalPrints += qty
    const normalized = normalizeOrderStatus(item.order.status)
    if (normalized === 'failed' || item.order.failedAt) {
      failedPrints += qty
    }
    if (normalized === 'completed' || normalized === 'shipped') {
      completedPrints += qty
    }
  }

  const verifiedReceiptKeys = new Set(downloads.map((entry) => `${entry.modelId}:${entry.userId}`))
  const verifiedReviewCount = comments.reduce((count, comment) => (
    verifiedReceiptKeys.has(`${comment.modelId}:${comment.userId}`) ? count + 1 : count
  ), 0)

  const failureRate = totalPrints > 0 ? failedPrints / totalPrints : 0
  const successfulPrints = Math.max(0, totalPrints - failedPrints)
  const completionRate = totalPrints > 0 ? completedPrints / totalPrints : 0
  const printReliability = totalPrints > 0 ? 1 - failureRate : 0.6
  const reviewScore = clamp(verifiedReviewCount / Math.max(modelIds.length * 3, 3))
  const badgeScore = clamp(badgeCount / 4)
  const downloadScore = clamp(totalDownloads / 250)
  const weightedScore = (
    printReliability * 0.4
    + completionRate * 0.25
    + reviewScore * 0.15
    + badgeScore * 0.1
    + downloadScore * 0.1
  ) * 100
  const score = Math.round(weightedScore)
  const tier = resolveTier(score)
  const summary = totalPrints > 0
    ? `${successfulPrints} successful print${successfulPrints === 1 ? '' : 's'}, ${Math.round(completionRate * 100)}% completion reliability, and ${verifiedReviewCount} verified review${verifiedReviewCount === 1 ? '' : 's'}.`
    : `${totalDownloads} download${totalDownloads === 1 ? '' : 's'} and ${verifiedReviewCount} verified review${verifiedReviewCount === 1 ? '' : 's'} so far.`

  return {
    score,
    tier,
    summary,
    modelCount: modelIds.length,
    totalDownloads,
    successfulPrints,
    totalPrints,
    failureRate,
    completionRate,
    verifiedReviewCount,
    badgeCount,
  }
}
