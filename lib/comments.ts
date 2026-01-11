import { prisma } from '@/lib/db'
import { toPublicHref } from '@/lib/storage'

export const commentUserSelect = {
  id: true,
  name: true,
  profile: { select: { slug: true, avatarImagePath: true } },
} as const

export const commentInclude = {
  orderBy: { createdAt: 'asc' as const },
  include: {
    user: { select: commentUserSelect },
  },
} as const

export type CommentKind = 'comment' | 'make'

export type SerializedComment = {
  id: string
  body: string
  createdAt: Date | string
  type: CommentKind
  imageUrl: string | null
  imageStatus?: string | null
  imageWidth: number | null
  imageHeight: number | null
  isVerified: boolean
  user: {
    id?: string
    name?: string | null
    profileSlug: string | null
    displayName: string
    avatarUrl: string | null
  }
}

export function serializeComment(comment: any): SerializedComment {
  const profileSlug = comment.user?.profile?.slug || null
  const displayName = comment.user?.name?.trim()
    || (profileSlug ? `@${profileSlug}` : 'Community maker')
  const type: CommentKind = comment.type === 'make' ? 'make' : 'comment'
  const imageUrl = toPublicHref(comment.imagePath) || null
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    type,
    imageUrl,
    imageStatus: comment.imageStatus ?? null,
    imageWidth: comment.imageWidth ?? null,
    imageHeight: comment.imageHeight ?? null,
    isVerified: Boolean(comment.isVerified),
    user: {
      id: comment.user?.id,
      name: comment.user?.name,
      profileSlug,
      displayName,
      avatarUrl: toPublicHref(comment.user?.profile?.avatarImagePath) || null,
    },
  }
}

type BlockedPattern = { regex: RegExp; message: string }

const BLOCKED_PATTERNS: BlockedPattern[] = [
  {
    regex: /\b(?:exploit|payload|malware|ransomware|virus|botnet|backdoor|ddos)\b/i,
    message: 'Comments referencing malware or exploits are not allowed.',
  },
  {
    regex: /\b(?:sql\s*injection|union\s+select|drop\s+table|insert\s+into)\b/i,
    message: 'Security testing or database attack content is blocked.',
  },
  {
    regex: /\b(?:xss|csrf|pentest|penetration testing|security testing)\b/i,
    message: 'Security testing discussions are not allowed in comments.',
  },
  {
    regex: /<script[\s>]/i,
    message: 'HTML/script tags are not allowed.',
  },
]

export function detectCommentViolation(body: string): string | null {
  const normalized = body.toLowerCase()
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.regex.test(normalized)) {
      return pattern.message
    }
  }
  return null
}

function uniqueUserIds(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  for (const value of values) {
    if (typeof value === 'string' && value) {
      seen.add(value)
    }
  }
  return Array.from(seen)
}

export async function findVerifiedCommentUserIds(modelId: string, userIds: (string | null | undefined)[]) {
  const ids = uniqueUserIds(userIds)
  if (!modelId || ids.length === 0) return new Set<string>()
  const [downloads, purchases] = await Promise.all([
    prisma.modelDownload.findMany({ where: { modelId, userId: { in: ids } }, select: { userId: true } }),
    prisma.printOrderItem.findMany({
      where: {
        modelId,
        order: { userId: { in: ids } },
      },
      select: { order: { select: { userId: true } } },
    }),
  ])
  const verified = new Set<string>()
  for (const entry of downloads) {
    if (entry.userId) verified.add(entry.userId)
  }
  for (const entry of purchases) {
    const orderUserId = entry.order?.userId
    if (orderUserId) verified.add(orderUserId)
  }
  return verified
}

export async function userHasModelReceipt(modelId: string, userId: string | null | undefined) {
  if (!modelId || !userId) return false
  const result = await findVerifiedCommentUserIds(modelId, [userId])
  return result.has(userId)
}
