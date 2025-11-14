import type { PrismaClient } from '@prisma/client'

type Def = { key: string; name: string; icon?: string; description?: string }

export const DEFAULT_ACHIEVEMENTS: Def[] = [
  { key: 'first_upload', name: 'First Upload', icon: '🆕', description: 'Uploaded your first model' },
  { key: 'uploads_5', name: '5 Uploads', icon: '✋', description: 'Uploaded 5 models' },
  { key: 'uploads_10', name: '10 Uploads', icon: '🔟', description: 'Uploaded 10 models' },
  { key: 'uploads_25', name: '25 Uploads', icon: '🏅', description: 'Uploaded 25 models' },
  { key: 'uploads_50', name: '50 Uploads', icon: '🥈', description: 'Uploaded 50 models' },
  { key: 'likes_10', name: '10 Likes', icon: '👍', description: 'Earned 10 total likes' },
  { key: 'likes_50', name: '50 Likes', icon: '🔥', description: 'Earned 50 total likes' },
  { key: 'likes_100', name: '100 Likes', icon: '🌟', description: 'Earned 100 total likes' },
  { key: 'downloads_100', name: '100 Downloads', icon: '⬇️', description: 'Reached 100 total downloads' },
  { key: 'downloads_500', name: '500 Downloads', icon: '📈', description: 'Reached 500 total downloads' },
  { key: 'downloads_1000', name: '1000 Downloads', icon: '🚀', description: 'Reached 1000 total downloads' },
  { key: 'profile_complete', name: 'Profile Complete', icon: '✅', description: 'Added avatar and bio' },
  { key: 'early_adopter', name: 'Early Adopter', icon: '🎉', description: 'Among the first 50 users' },
  { key: 'top_uploader', name: 'Top Uploader', icon: '🥇', description: 'Top 10 by upload count' },
]

export async function ensureDefaultAchievements(prisma: PrismaClient) {
  for (const d of DEFAULT_ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: d.key },
      update: { name: d.name, icon: d.icon, description: d.description },
      create: { key: d.key, name: d.name, icon: d.icon, description: d.description },
    })
  }
}

export async function awardIf(prisma: PrismaClient, userId: string, key: string, condition: boolean) {
  if (!condition) return
  const ach = await prisma.achievement.findUnique({ where: { key } })
  if (!ach) return
  try {
    await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId: ach.id } },
      update: {},
      create: { userId, achievementId: ach.id },
    })
  } catch {
    // already awarded
  }
}

export async function refreshUserAchievements(prisma: PrismaClient, userId: string) {
  await ensureDefaultAchievements(prisma)

  const uploads = await prisma.model.count({ where: { userId } })
  const sums = await prisma.model.aggregate({
    where: { userId },
    _sum: { likes: true, downloads: true },
  })
  const totalLikes = sums._sum.likes || 0
  const totalDownloads = sums._sum.downloads || 0

  await awardIf(prisma, userId, 'first_upload', uploads >= 1)
  await awardIf(prisma, userId, 'uploads_5', uploads >= 5)
  await awardIf(prisma, userId, 'uploads_10', uploads >= 10)
  await awardIf(prisma, userId, 'uploads_25', uploads >= 25)
  await awardIf(prisma, userId, 'uploads_50', uploads >= 50)

  await awardIf(prisma, userId, 'likes_10', totalLikes >= 10)
  await awardIf(prisma, userId, 'likes_50', totalLikes >= 50)
  await awardIf(prisma, userId, 'likes_100', totalLikes >= 100)

  await awardIf(prisma, userId, 'downloads_100', totalDownloads >= 100)
  await awardIf(prisma, userId, 'downloads_500', totalDownloads >= 500)
  await awardIf(prisma, userId, 'downloads_1000', totalDownloads >= 1000)

  // Profile complete: avatar + bio present
  const profile = await prisma.profile.findUnique({ where: { userId } })
  const profileComplete = !!(profile && profile.avatarImagePath && profile.bio && profile.bio.trim().length >= 10)
  await awardIf(prisma, userId, 'profile_complete', profileComplete)

  // Early adopter: first 50 users by createdAt
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })
  if (me?.createdAt) {
    const countBefore = await prisma.user.count({ where: { createdAt: { lte: me.createdAt } } })
    await awardIf(prisma, userId, 'early_adopter', countBefore <= 50)
  }

  // Top uploader: top 10 by upload count
  const top10 = await prisma.model.groupBy({
    by: ['userId'],
    _count: { _all: true },
    // Order by count of a stable field (id) since _all is not supported in orderBy typing
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })
  await awardIf(prisma, userId, 'top_uploader', top10.some(t => t.userId === userId))
}
