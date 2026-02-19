import path from 'path'
import { unlink } from 'fs/promises'
import { prisma } from '@/lib/db'
import { storageRoot } from '@/lib/storage'

export type RetentionPolicy = {
  uploadsDays: number
  logsDays: number
  messagesDays: number
}

export type RetentionCleanupSummary = {
  dryRun: boolean
  policy: RetentionPolicy
  modelsCoverSourceCleared: number
  modelImageSourceCleared: number
  profileAvatarSourceCleared: number
  commentImageSourceCleared: number
  printOrderMessagesDeleted: number
  modelCommentsDeleted: number
  rateLimitEntriesDeleted: number
  configLogsDeleted: number
  filesDeleted: number
}

function readPositiveInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

export function getRetentionPolicy(): RetentionPolicy {
  return {
    uploadsDays: readPositiveInt('DATA_RETENTION_UPLOAD_DAYS', 90),
    logsDays: readPositiveInt('DATA_RETENTION_LOG_DAYS', 180),
    messagesDays: readPositiveInt('DATA_RETENTION_MESSAGE_DAYS', 365),
  }
}

function resolveStorageFile(input: string | null | undefined) {
  if (!input) return null
  const normalized = String(input).trim().replace(/^\/+/, '')
  if (!normalized || normalized.includes('..')) return null
  return path.join(storageRoot(), normalized)
}

async function deleteFiles(paths: Array<string | null | undefined>, dryRun: boolean) {
  let filesDeleted = 0
  const unique = new Set(paths.map(resolveStorageFile).filter((entry): entry is string => Boolean(entry)))
  if (dryRun) return { filesDeleted: unique.size }
  for (const filePath of unique) {
    try {
      await unlink(filePath)
      filesDeleted += 1
    } catch {
      // best-effort cleanup
    }
  }
  return { filesDeleted }
}

export async function runDataRetentionCleanup(input?: { dryRun?: boolean }) {
  const dryRun = Boolean(input?.dryRun)
  const policy = getRetentionPolicy()
  const now = Date.now()
  const uploadsCutoff = new Date(now - policy.uploadsDays * 24 * 60 * 60 * 1000)
  const logsCutoff = new Date(now - policy.logsDays * 24 * 60 * 60 * 1000)
  const messagesCutoff = new Date(now - policy.messagesDays * 24 * 60 * 60 * 1000)

  const [models, modelImages, profiles, makeComments] = await Promise.all([
    prisma.model.findMany({
      where: {
        coverImageSourcePath: { not: null },
        updatedAt: { lt: uploadsCutoff },
        NOT: { coverImageStatus: 'processing' },
      },
      select: { id: true, coverImageSourcePath: true },
      take: 5000,
    }),
    prisma.modelImage.findMany({
      where: {
        sourcePath: { not: null },
        createdAt: { lt: uploadsCutoff },
        NOT: { status: 'processing' },
      },
      select: { id: true, sourcePath: true },
      take: 10000,
    }),
    prisma.profile.findMany({
      where: {
        avatarImageSourcePath: { not: null },
        createdAt: { lt: uploadsCutoff },
        NOT: { avatarImageStatus: 'processing' },
      },
      select: { userId: true, avatarImageSourcePath: true },
      take: 5000,
    }),
    prisma.modelComment.findMany({
      where: {
        imageSourcePath: { not: null },
        updatedAt: { lt: uploadsCutoff },
        NOT: { imageStatus: 'processing' },
      },
      select: { id: true, imageSourcePath: true },
      take: 10000,
    }),
  ])

  const sourcePaths = [
    ...models.map((row) => row.coverImageSourcePath),
    ...modelImages.map((row) => row.sourcePath),
    ...profiles.map((row) => row.avatarImageSourcePath),
    ...makeComments.map((row) => row.imageSourcePath),
  ]
  const fileDeleteResult = await deleteFiles(sourcePaths, dryRun)

  let modelsCoverSourceCleared = models.length
  let modelImageSourceCleared = modelImages.length
  let profileAvatarSourceCleared = profiles.length
  let commentImageSourceCleared = makeComments.length
  let printOrderMessagesDeleted = 0
  let modelCommentsDeleted = 0
  let rateLimitEntriesDeleted = 0
  let configLogsDeleted = 0

  if (!dryRun) {
    const [poMsgDelete, modelCommentDelete, rateLimitDelete, configDelete] = await Promise.all([
      prisma.printOrderMessage.deleteMany({ where: { createdAt: { lt: messagesCutoff } } }),
      prisma.modelComment.deleteMany({ where: { createdAt: { lt: messagesCutoff } } }),
      prisma.rateLimit.deleteMany({ where: { updatedAt: { lt: logsCutoff } } }),
      prisma.configChangeLog.deleteMany({ where: { createdAt: { lt: logsCutoff } } }),
    ])
    printOrderMessagesDeleted = poMsgDelete.count
    modelCommentsDeleted = modelCommentDelete.count
    rateLimitEntriesDeleted = rateLimitDelete.count
    configLogsDeleted = configDelete.count

    if (models.length > 0) {
      await prisma.model.updateMany({
        where: { id: { in: models.map((row) => row.id) } },
        data: { coverImageSourcePath: null },
      })
    }
    if (modelImages.length > 0) {
      await prisma.modelImage.updateMany({
        where: { id: { in: modelImages.map((row) => row.id) } },
        data: { sourcePath: null },
      })
    }
    if (profiles.length > 0) {
      await prisma.profile.updateMany({
        where: { userId: { in: profiles.map((row) => row.userId) } },
        data: { avatarImageSourcePath: null },
      })
    }
    if (makeComments.length > 0) {
      await prisma.modelComment.updateMany({
        where: { id: { in: makeComments.map((row) => row.id) } },
        data: { imageSourcePath: null },
      })
    }
  }

  return {
    dryRun,
    policy,
    modelsCoverSourceCleared,
    modelImageSourceCleared,
    profileAvatarSourceCleared,
    commentImageSourceCleared,
    printOrderMessagesDeleted,
    modelCommentsDeleted,
    rateLimitEntriesDeleted,
    configLogsDeleted,
    filesDeleted: fileDeleteResult.filesDeleted,
  } satisfies RetentionCleanupSummary
}
