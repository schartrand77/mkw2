import type { PrismaClient } from '@prisma/client'

type Def = { key: string; name: string; icon?: string; description?: string }

export const DEFAULT_ACHIEVEMENTS: Def[] = [
  { key: 'first_upload', name: 'First Upload', icon: 'U1', description: 'Uploaded your first model' },
  { key: 'uploads_5', name: '5 Uploads', icon: 'U5', description: 'Uploaded 5 models' },
  { key: 'uploads_10', name: '10 Uploads', icon: 'U10', description: 'Uploaded 10 models' },
  { key: 'uploads_25', name: '25 Uploads', icon: 'U25', description: 'Uploaded 25 models' },
  { key: 'uploads_50', name: '50 Uploads', icon: 'U50', description: 'Uploaded 50 models' },
  { key: 'uploads_100', name: '100 Uploads', icon: 'U100', description: 'Uploaded 100 models' },
  { key: 'uploads_250', name: '250 Uploads', icon: 'U250', description: 'Uploaded 250 models' },
  { key: 'uploads_500', name: '500 Uploads', icon: 'U500', description: 'Uploaded 500 models' },
  { key: 'uploads_1000', name: '1000 Uploads', icon: 'U1K', description: 'Uploaded 1000 models' },
  { key: 'likes_10', name: '10 Likes', icon: 'L10', description: 'Earned 10 total likes' },
  { key: 'likes_50', name: '50 Likes', icon: 'L50', description: 'Earned 50 total likes' },
  { key: 'likes_100', name: '100 Likes', icon: 'L100', description: 'Earned 100 total likes' },
  { key: 'likes_250', name: '250 Likes', icon: 'L250', description: 'Earned 250 total likes' },
  { key: 'likes_500', name: '500 Likes', icon: 'L500', description: 'Earned 500 total likes' },
  { key: 'likes_1000', name: '1000 Likes', icon: 'L1K', description: 'Earned 1000 total likes' },
  { key: 'likes_5000', name: '5000 Likes', icon: 'L5K', description: 'Earned 5000 total likes' },
  { key: 'downloads_100', name: '100 Downloads', icon: 'D100', description: 'Reached 100 total downloads' },
  { key: 'downloads_500', name: '500 Downloads', icon: 'D500', description: 'Reached 500 total downloads' },
  { key: 'downloads_1000', name: '1000 Downloads', icon: 'D1K', description: 'Reached 1000 total downloads' },
  { key: 'downloads_2000', name: '2000 Downloads', icon: 'D2K', description: 'Reached 2000 total downloads' },
  { key: 'downloads_5000', name: '5000 Downloads', icon: 'D5K', description: 'Reached 5000 total downloads' },
  { key: 'downloads_10000', name: '10000 Downloads', icon: 'D10K', description: 'Reached 10000 total downloads' },
  { key: 'downloads_50000', name: '50000 Downloads', icon: 'D50K', description: 'Reached 50000 total downloads' },
  { key: 'comments_1', name: 'First Comment', icon: 'C1', description: 'Left your first comment' },
  { key: 'comments_10', name: '10 Comments', icon: 'C10', description: 'Left 10 comments' },
  { key: 'comments_25', name: '25 Comments', icon: 'C25', description: 'Left 25 comments' },
  { key: 'comments_100', name: '100 Comments', icon: 'C100', description: 'Left 100 comments' },
  { key: 'likes_given_1', name: 'First Like Given', icon: 'LG1', description: 'Liked your first model' },
  { key: 'likes_given_25', name: '25 Likes Given', icon: 'LG25', description: 'Liked 25 models' },
  { key: 'likes_given_100', name: '100 Likes Given', icon: 'LG100', description: 'Liked 100 models' },
  { key: 'likes_given_500', name: '500 Likes Given', icon: 'LG500', description: 'Liked 500 models' },
  { key: 'downloads_given_1', name: 'First Download', icon: 'DG1', description: 'Downloaded your first model' },
  { key: 'downloads_given_10', name: '10 Downloads Made', icon: 'DG10', description: 'Downloaded 10 models' },
  { key: 'downloads_given_50', name: '50 Downloads Made', icon: 'DG50', description: 'Downloaded 50 models' },
  { key: 'downloads_given_200', name: '200 Downloads Made', icon: 'DG200', description: 'Downloaded 200 models' },
  { key: 'cover_1', name: 'Cover Added', icon: 'CV1', description: 'Added a cover image' },
  { key: 'cover_5', name: '5 Covers', icon: 'CV5', description: 'Added 5 cover images' },
  { key: 'cover_10', name: '10 Covers', icon: 'CV10', description: 'Added 10 cover images' },
  { key: 'material_variety_3', name: 'Material Mix', icon: 'M3', description: 'Used 3 different materials' },
  { key: 'material_variety_5', name: 'Material Variety', icon: 'M5', description: 'Used 5 different materials' },
  { key: 'material_variety_8', name: 'Material Explorer', icon: 'M8', description: 'Used 8 different materials' },
  { key: 'featured_model', name: 'Featured Model', icon: 'F1', description: 'Had a model featured' },
  { key: 'profile_avatar', name: 'Avatar Uploaded', icon: 'AV', description: 'Added a profile avatar' },
  { key: 'profile_bio', name: 'Bio Written', icon: 'BIO', description: 'Added a profile bio' },
  { key: 'profile_contact', name: 'Contact Ready', icon: 'CON', description: 'Added contact info' },
  { key: 'profile_social', name: 'Social Links', icon: 'SOC', description: 'Added a social link' },
  { key: 'profile_website', name: 'Website Linked', icon: 'WEB', description: 'Added a website link' },
  { key: 'profile_complete', name: 'Profile Complete', icon: 'PRO', description: 'Added avatar and bio' },
  { key: 'email_verified', name: 'Email Verified', icon: 'MAIL', description: 'Verified your email address' },
  { key: 'member_1y', name: 'One Year Member', icon: 'Y1', description: 'Member for one year' },
  { key: 'member_2y', name: 'Two Year Member', icon: 'Y2', description: 'Member for two years' },
  { key: 'early_adopter', name: 'Early Adopter', icon: 'EA', description: 'Among the first 50 users' },
  { key: 'top_uploader', name: 'Top Uploader', icon: 'TOP', description: 'Top 10 by upload count' },
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

  const [
    uploads,
    sums,
    likesGiven,
    commentsGiven,
    downloadsGiven,
    profile,
    me,
    featuredCount,
    coverCount,
    materialGroups,
  ] = await Promise.all([
    prisma.model.count({ where: { userId } }),
    prisma.model.aggregate({
      where: { userId },
      _sum: { likes: true, downloads: true },
    }),
    prisma.like.count({ where: { userId } }),
    prisma.modelComment.count({ where: { userId } }),
    prisma.modelDownload.count({ where: { userId } }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, emailVerified: true } }),
    prisma.featuredModel.count({ where: { model: { userId } } }),
    prisma.model.count({ where: { userId, coverImagePath: { not: null } } }),
    prisma.model.groupBy({ by: ['material'], where: { userId } }),
  ])

  const totalLikes = sums._sum.likes || 0
  const totalDownloads = sums._sum.downloads || 0
  const materialVariety = materialGroups.length

  await awardIf(prisma, userId, 'first_upload', uploads >= 1)
  await awardIf(prisma, userId, 'uploads_5', uploads >= 5)
  await awardIf(prisma, userId, 'uploads_10', uploads >= 10)
  await awardIf(prisma, userId, 'uploads_25', uploads >= 25)
  await awardIf(prisma, userId, 'uploads_50', uploads >= 50)
  await awardIf(prisma, userId, 'uploads_100', uploads >= 100)
  await awardIf(prisma, userId, 'uploads_250', uploads >= 250)
  await awardIf(prisma, userId, 'uploads_500', uploads >= 500)
  await awardIf(prisma, userId, 'uploads_1000', uploads >= 1000)

  await awardIf(prisma, userId, 'likes_10', totalLikes >= 10)
  await awardIf(prisma, userId, 'likes_50', totalLikes >= 50)
  await awardIf(prisma, userId, 'likes_100', totalLikes >= 100)
  await awardIf(prisma, userId, 'likes_250', totalLikes >= 250)
  await awardIf(prisma, userId, 'likes_500', totalLikes >= 500)
  await awardIf(prisma, userId, 'likes_1000', totalLikes >= 1000)
  await awardIf(prisma, userId, 'likes_5000', totalLikes >= 5000)

  await awardIf(prisma, userId, 'downloads_100', totalDownloads >= 100)
  await awardIf(prisma, userId, 'downloads_500', totalDownloads >= 500)
  await awardIf(prisma, userId, 'downloads_1000', totalDownloads >= 1000)
  await awardIf(prisma, userId, 'downloads_2000', totalDownloads >= 2000)
  await awardIf(prisma, userId, 'downloads_5000', totalDownloads >= 5000)
  await awardIf(prisma, userId, 'downloads_10000', totalDownloads >= 10000)
  await awardIf(prisma, userId, 'downloads_50000', totalDownloads >= 50000)

  await awardIf(prisma, userId, 'comments_1', commentsGiven >= 1)
  await awardIf(prisma, userId, 'comments_10', commentsGiven >= 10)
  await awardIf(prisma, userId, 'comments_25', commentsGiven >= 25)
  await awardIf(prisma, userId, 'comments_100', commentsGiven >= 100)

  await awardIf(prisma, userId, 'likes_given_1', likesGiven >= 1)
  await awardIf(prisma, userId, 'likes_given_25', likesGiven >= 25)
  await awardIf(prisma, userId, 'likes_given_100', likesGiven >= 100)
  await awardIf(prisma, userId, 'likes_given_500', likesGiven >= 500)

  await awardIf(prisma, userId, 'downloads_given_1', downloadsGiven >= 1)
  await awardIf(prisma, userId, 'downloads_given_10', downloadsGiven >= 10)
  await awardIf(prisma, userId, 'downloads_given_50', downloadsGiven >= 50)
  await awardIf(prisma, userId, 'downloads_given_200', downloadsGiven >= 200)

  await awardIf(prisma, userId, 'cover_1', coverCount >= 1)
  await awardIf(prisma, userId, 'cover_5', coverCount >= 5)
  await awardIf(prisma, userId, 'cover_10', coverCount >= 10)

  await awardIf(prisma, userId, 'material_variety_3', materialVariety >= 3)
  await awardIf(prisma, userId, 'material_variety_5', materialVariety >= 5)
  await awardIf(prisma, userId, 'material_variety_8', materialVariety >= 8)

  await awardIf(prisma, userId, 'featured_model', featuredCount >= 1)

  // Profile complete: avatar + bio present
  const hasAvatar = !!profile?.avatarImagePath
  const hasBio = !!(profile?.bio && profile.bio.trim().length >= 10)
  const hasContact = !!(profile?.contactEmail || profile?.contactPhone || profile?.websiteUrl)
  const hasSocial = !!(
    profile?.socialTwitter ||
    profile?.socialInstagram ||
    profile?.socialTikTok ||
    profile?.socialYoutube ||
    profile?.socialBluesky ||
    profile?.socialFacebook
  )
  const hasWebsite = !!profile?.websiteUrl
  const profileComplete = hasAvatar && hasBio
  await awardIf(prisma, userId, 'profile_avatar', hasAvatar)
  await awardIf(prisma, userId, 'profile_bio', hasBio)
  await awardIf(prisma, userId, 'profile_contact', hasContact)
  await awardIf(prisma, userId, 'profile_social', hasSocial)
  await awardIf(prisma, userId, 'profile_website', hasWebsite)
  await awardIf(prisma, userId, 'profile_complete', profileComplete)

  // Early adopter: first 50 users by createdAt
  const accountAgeDays = me?.createdAt ? (Date.now() - me.createdAt.getTime()) / 86400000 : 0
  await awardIf(prisma, userId, 'email_verified', !!me?.emailVerified)
  await awardIf(prisma, userId, 'member_1y', accountAgeDays >= 365)
  await awardIf(prisma, userId, 'member_2y', accountAgeDays >= 730)
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
