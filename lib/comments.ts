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

export type SerializedComment = {
  id: string
  body: string
  createdAt: Date | string
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
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
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
