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
  partReview?: {
    partId: string
    partName: string
    pin?: {
      x: number
      y: number
      z: number
    } | null
  } | null
  user: {
    id?: string
    name?: string | null
    profileSlug: string | null
    displayName: string
    avatarUrl: string | null
  }
}

const PART_REVIEW_RE = /^\[\[part-review:([^|\]]+)\|([^\]]+)\]\]\s*/i

export function encodePartReviewBody(body: string, partId?: string | null, partName?: string | null) {
  const trimmed = body.trim()
  if (!partId || !partName) return trimmed
  const cleanPartId = String(partId).trim()
  const cleanPartName = String(partName).trim().replace(/\]\]/g, '').replace(/\|/g, '/')
  if (!cleanPartId || !cleanPartName) return trimmed
  return `[[part-review:${cleanPartId}|${cleanPartName}]] ${trimmed}`.trim()
}

export function extractPartReviewBody(body: string | null | undefined) {
  const raw = typeof body === 'string' ? body : ''
  const match = raw.match(PART_REVIEW_RE)
  if (!match) {
    return {
      body: raw,
      partReview: null as { partId: string; partName: string } | null,
    }
  }
  return {
    body: raw.replace(PART_REVIEW_RE, '').trim(),
    partReview: {
      partId: match[1].trim(),
      partName: match[2].trim(),
    },
  }
}

export function serializeComment(comment: any): SerializedComment {
  const partPayload = extractPartReviewBody(comment.body)
  const partId = typeof comment.partId === 'string' && comment.partId.trim() ? comment.partId.trim() : partPayload.partReview?.partId || null
  const partName = typeof comment.partName === 'string' && comment.partName.trim() ? comment.partName.trim() : partPayload.partReview?.partName || null
  const pinX = typeof comment.pinX === 'number' && Number.isFinite(comment.pinX) ? comment.pinX : null
  const pinY = typeof comment.pinY === 'number' && Number.isFinite(comment.pinY) ? comment.pinY : null
  const pinZ = typeof comment.pinZ === 'number' && Number.isFinite(comment.pinZ) ? comment.pinZ : null
  const profileSlug = comment.user?.profile?.slug || null
  const displayName = comment.user?.name?.trim()
    || (profileSlug ? `@${profileSlug}` : 'Community maker')
  const type: CommentKind = comment.type === 'make' ? 'make' : 'comment'
  const imageUrl = toPublicHref(comment.imagePath) || null
  return {
    id: comment.id,
    body: partPayload.body,
    createdAt: comment.createdAt,
    type,
    imageUrl,
    imageStatus: comment.imageStatus ?? null,
    imageWidth: comment.imageWidth ?? null,
    imageHeight: comment.imageHeight ?? null,
    isVerified: Boolean(comment.isVerified),
    partReview: partId && partName ? {
      partId,
      partName,
      pin: pinX != null && pinY != null && pinZ != null ? { x: pinX, y: pinY, z: pinZ } : null,
    } : null,
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
