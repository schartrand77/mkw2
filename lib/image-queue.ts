import path from 'path'
import sharp from 'sharp'
import { readFile, unlink } from 'fs/promises'
import { prisma } from '@/lib/db'
import { applyKnownOrientation, ensureProcessableImageBuffer } from '@/lib/image-processing'
import { isHeicLikeSource } from '@/lib/images'
import { saveBuffer, storageRoot } from '@/lib/storage'
import { sendAdminPushNotification } from '@/lib/push'
import { notifyModelProcessingReady } from '@/lib/model-processing-notifications'

const STATUS_PROCESSING = 'processing'
const STATUS_READY = 'ready'
const STATUS_FAILED = 'failed'

type ProcessResult = {
  processed: number
  failed: number
}

type ImageQueueOptions = {
  modelId?: string
  includeAvatars?: boolean
  includeComments?: boolean
}

export function buildCoverImageWhere(options: Pick<ImageQueueOptions, 'modelId'> = {}) {
  const where: Record<string, any> = {
    coverImageStatus: STATUS_PROCESSING,
    coverImageSourcePath: { not: null },
    coverImagePath: { not: null },
  }
  if (options.modelId) where.id = options.modelId
  return where
}

export function buildModelImageWhere(options: Pick<ImageQueueOptions, 'modelId'> = {}) {
  const where: Record<string, any> = {
    status: STATUS_PROCESSING,
    sourcePath: { not: null },
  }
  if (options.modelId) where.modelId = options.modelId
  return where
}

function resolveStoragePath(storedPath: string) {
  const normalized = storedPath.replace(/^\/+/, '')
  return path.join(storageRoot(), normalized)
}

function sanitizeError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.slice(0, 500)
}

async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath)
  } catch {
    // ignore
  }
}

async function processCoverImages(limit: number, modelId?: string): Promise<ProcessResult> {
  const candidates = await prisma.model.findMany({
    where: buildCoverImageWhere({ modelId }),
    select: { id: true, title: true, userId: true, coverImageSourcePath: true, coverImagePath: true },
    take: limit,
  })

  let processed = 0
  let failed = 0

  for (const model of candidates) {
    try {
      const sourcePath = resolveStoragePath(model.coverImageSourcePath!)
      const filename = path.basename(sourcePath)
      let pipeline: sharp.Sharp
      if (isHeicLikeSource(filename)) {
        const buf = await readFile(sourcePath)
        const prepared = await ensureProcessableImageBuffer(buf, { filename })
        pipeline = applyKnownOrientation(sharp(prepared.buffer), prepared.orientation)
      } else {
        pipeline = sharp(sourcePath).rotate()
      }
      const out = await pipeline.resize(1600, 1200, { fit: 'inside' }).webp({ quality: 88 }).toBuffer()
      const targetRel = model.coverImagePath!.replace(/^\/+/, '')
      await saveBuffer(targetRel, out)
      await prisma.model.update({
        where: { id: model.id },
        data: {
          coverImageStatus: STATUS_READY,
          coverImageSourcePath: null,
          coverImageError: null,
        },
      })
      await safeUnlink(sourcePath)
      await notifyModelProcessingReady({
        modelId: model.id,
        userId: model.userId,
        modelTitle: model.title,
        kind: 'cover',
      })
      processed += 1
    } catch (err) {
      await prisma.model.update({
        where: { id: model.id },
        data: { coverImageStatus: STATUS_FAILED, coverImageError: sanitizeError(err) },
      })
      failed += 1
    }
  }

  return { processed, failed }
}

async function processModelImages(limit: number, modelId?: string): Promise<ProcessResult> {
  const images = await prisma.modelImage.findMany({
    where: buildModelImageWhere({ modelId }),
    select: { id: true, sourcePath: true, filePath: true },
    take: limit,
  })

  let processed = 0
  let failed = 0

  for (const image of images) {
    try {
      const sourcePath = resolveStoragePath(image.sourcePath!)
      const filename = path.basename(sourcePath)
      let pipeline: sharp.Sharp
      if (isHeicLikeSource(filename)) {
        const buf = await readFile(sourcePath)
        const prepared = await ensureProcessableImageBuffer(buf, { filename })
        pipeline = applyKnownOrientation(sharp(prepared.buffer), prepared.orientation)
      } else {
        pipeline = sharp(sourcePath).rotate()
      }
      const out = await pipeline.resize(1600, 1200, { fit: 'inside' }).webp({ quality: 88 }).toBuffer()
      const targetRel = image.filePath.replace(/^\/+/, '')
      await saveBuffer(targetRel, out)
      await prisma.modelImage.update({
        where: { id: image.id },
        data: { status: STATUS_READY, sourcePath: null, error: null },
      })
      const coverModels = await prisma.model.findMany({
        where: { coverImagePath: image.filePath, coverImageStatus: STATUS_PROCESSING },
        select: { id: true, title: true, userId: true },
      })
      await prisma.model.updateMany({
        where: { coverImagePath: image.filePath, coverImageStatus: STATUS_PROCESSING },
        data: { coverImageStatus: STATUS_READY, coverImageError: null },
      })
      await safeUnlink(sourcePath)
      if (coverModels.length) {
        await Promise.all(coverModels.map((model) => notifyModelProcessingReady({
          modelId: model.id,
          userId: model.userId,
          modelTitle: model.title,
          kind: 'cover',
        })))
      }
      processed += 1
    } catch (err) {
      await prisma.modelImage.update({
        where: { id: image.id },
        data: { status: STATUS_FAILED, error: sanitizeError(err) },
      })
      failed += 1
    }
  }

  return { processed, failed }
}

async function processProfileAvatars(limit: number): Promise<ProcessResult> {
  const profiles = await prisma.profile.findMany({
    where: {
      avatarImageStatus: STATUS_PROCESSING,
      avatarImageSourcePath: { not: null },
      avatarImagePath: { not: null },
    },
    select: { id: true, avatarImageSourcePath: true, avatarImagePath: true },
    take: limit,
  })

  let processed = 0
  let failed = 0

  for (const profile of profiles) {
    try {
      const sourcePath = resolveStoragePath(profile.avatarImageSourcePath!)
      const filename = path.basename(sourcePath)
      let pipeline: sharp.Sharp
      if (isHeicLikeSource(filename)) {
        const buf = await readFile(sourcePath)
        const prepared = await ensureProcessableImageBuffer(buf, { filename })
        pipeline = applyKnownOrientation(sharp(prepared.buffer), prepared.orientation)
      } else {
        pipeline = sharp(sourcePath).rotate()
      }
      const out = await pipeline.resize(512, 512, { fit: 'cover' }).webp({ quality: 90 }).toBuffer()
      const targetRel = profile.avatarImagePath!.replace(/^\/+/, '')
      await saveBuffer(targetRel, out)
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          avatarImageStatus: STATUS_READY,
          avatarImageSourcePath: null,
          avatarImageError: null,
        },
      })
      await safeUnlink(sourcePath)
      processed += 1
    } catch (err) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { avatarImageStatus: STATUS_FAILED, avatarImageError: sanitizeError(err) },
      })
      failed += 1
    }
  }

  return { processed, failed }
}

export async function processPendingAvatars(limit = 5) {
  return processProfileAvatars(limit)
}

async function processCommentImages(limit: number): Promise<ProcessResult> {
  const comments = await prisma.modelComment.findMany({
    where: {
      imageStatus: STATUS_PROCESSING,
      imageSourcePath: { not: null },
      imagePath: { not: null },
    },
    select: { id: true, imageSourcePath: true, imagePath: true },
    take: limit,
  })

  let processed = 0
  let failed = 0

  for (const comment of comments) {
    try {
      const sourcePath = resolveStoragePath(comment.imageSourcePath!)
      const filename = path.basename(sourcePath)
      let pipeline: sharp.Sharp
      if (isHeicLikeSource(filename)) {
        const buf = await readFile(sourcePath)
        const prepared = await ensureProcessableImageBuffer(buf, { filename })
        pipeline = applyKnownOrientation(sharp(prepared.buffer), prepared.orientation)
      } else {
        pipeline = sharp(sourcePath).rotate()
      }
      const out = await pipeline.resize(1024, 1024, { fit: 'inside' }).webp({ quality: 74, effort: 5 }).toBuffer()
      const targetRel = comment.imagePath!.replace(/^\/+/, '')
      await saveBuffer(targetRel, out)
      const meta = await sharp(out).metadata()
      await prisma.modelComment.update({
        where: { id: comment.id },
        data: {
          imageStatus: STATUS_READY,
          imageSourcePath: null,
          imageError: null,
          imageWidth: typeof meta.width === 'number' ? meta.width : null,
          imageHeight: typeof meta.height === 'number' ? meta.height : null,
        },
      })
      await safeUnlink(sourcePath)
      processed += 1
    } catch (err) {
      await prisma.modelComment.update({
        where: { id: comment.id },
        data: { imageStatus: STATUS_FAILED, imageError: sanitizeError(err) },
      })
      failed += 1
    }
  }

  return { processed, failed }
}

export async function processPendingImages(limitPerType = 5, options: ImageQueueOptions = {}) {
  const modelId = options.modelId
  const includeAvatars = options.includeAvatars ?? !modelId
  const includeComments = options.includeComments ?? !modelId
  const [cover, modelImages, avatars, comments] = await Promise.all([
    processCoverImages(limitPerType, modelId),
    processModelImages(limitPerType, modelId),
    includeAvatars ? processProfileAvatars(limitPerType) : Promise.resolve({ processed: 0, failed: 0 }),
    includeComments ? processCommentImages(limitPerType) : Promise.resolve({ processed: 0, failed: 0 }),
  ])
  const totalProcessed = cover.processed + modelImages.processed + avatars.processed + comments.processed
  const totalFailed = cover.failed + modelImages.failed + avatars.failed + comments.failed

  if (totalProcessed || totalFailed) {
    await sendAdminPushNotification({
      title: 'Image processing queue',
      body: `Processed ${totalProcessed} image${totalProcessed === 1 ? '' : 's'} (${totalFailed} failed).`,
      url: '/admin',
      tag: 'image-processing',
      data: { processed: totalProcessed, failed: totalFailed },
    }).catch(() => {})
  }

  return {
    cover,
    modelImages,
    avatars,
    comments,
    totalProcessed,
    totalFailed,
  }
}
