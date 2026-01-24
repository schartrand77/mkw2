import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import path from 'path'
import { createWriteStream } from 'fs'
import { readFile, rename, unlink } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { Readable, Transform } from 'stream'
import { randomUUID } from 'crypto'
import Busboy from 'busboy'
import UnzipperParse from 'unzipper/lib/parse'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { ensureDir, saveBuffer, storageRoot } from '@/lib/storage'
import { computeStlStatsMm } from '@/lib/stl'
import { estimatePriceUSD, resolveModelPricing } from '@/lib/pricing'
import { refreshUserAchievements } from '@/lib/achievements'
import { isSupportedImageFile } from '@/lib/images'
import { sendAdminDiscordNotification } from '@/lib/discord'
import { sendAdminPushNotification } from '@/lib/push'
import { processPendingImages } from '@/lib/image-queue'
import { convert3mfToStl, enqueueModelPreviewJob, processPendingModelPreviews } from '@/lib/model-preview-queue'
import { scaleStatsToTargetDimensions } from '@/lib/model-dimensions'

const isAllowedModel = (name: string) => /\.(stl|obj|3mf)$/i.test(name)

const MAX_UPLOAD_FILE_BYTES = readByteEnv('UPLOAD_MAX_FILE_BYTES', 100 * 1024 * 1024)
const MAX_UPLOAD_TOTAL_BYTES = readByteEnv('UPLOAD_MAX_TOTAL_BYTES', 200 * 1024 * 1024)

function normalizeOrigin(url?: string | null) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.origin
  } catch {
    return null
  }
}

function readByteEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function applyCorsHeaders(req: NextRequest, res: NextResponse, directUploadUrl?: string | null) {
  const allowedOrigin = normalizeOrigin(directUploadUrl)
  const requestOrigin = req.headers.get('origin')
  if (allowedOrigin && requestOrigin && requestOrigin === allowedOrigin) {
    res.headers.set('Access-Control-Allow-Origin', requestOrigin)
    res.headers.set('Access-Control-Allow-Credentials', 'true')
  }
  return res
}

function applyPreflightCors(req: NextRequest, res: NextResponse, directUploadUrl?: string | null) {
  const allowedOrigin = normalizeOrigin(directUploadUrl)
  const requestOrigin = req.headers.get('origin')
  if (allowedOrigin && requestOrigin && requestOrigin === allowedOrigin) {
    const requestedHeaders = req.headers.get('access-control-request-headers') || 'content-type'
    res.headers.set('Access-Control-Allow-Origin', requestOrigin)
    res.headers.set('Access-Control-Allow-Credentials', 'true')
    res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS')
    res.headers.set('Access-Control-Allow-Headers', requestedHeaders)
    res.headers.set('Access-Control-Max-Age', '86400')
  }
  return res
}

function jsonWithCors(req: NextRequest, body: any, init: ResponseInit | undefined, directUploadUrl?: string | null) {
  const res = NextResponse.json(body, init)
  return applyCorsHeaders(req, res, directUploadUrl)
}

function uploadError(message: string, status = 400) {
  const err = new Error(message) as Error & { status?: number }
  err.status = status
  return err
}

type TempModelFile = {
  originalName: string
  ext: string
  tempRel: string
  tempFull: string
  size: number
}

type ParsedUpload = {
  fields: Record<string, string>
  modelFiles: TempModelFile[]
  coverImageSourceRel?: string
  sawModelInput: boolean
}

function buildTempRelPath(userId: string, filename: string) {
  const ext = path.extname(filename) || '.bin'
  const base = safeName(path.basename(filename, ext)) || 'upload'
  return path.join(userId, 'tmp', `${Date.now()}-${randomUUID()}-${base}${ext}`)
}

async function streamToStorage(relPath: string, stream: NodeJS.ReadableStream, onBytes?: (size: number) => void) {
  const full = path.join(storageRoot(), relPath)
  await ensureDir(path.dirname(full))
  const out = createWriteStream(full)
  if (!onBytes) {
    await pipeline(stream, out)
    return full
  }
  const counter = new Transform({
    transform(chunk, _enc, cb) {
      try {
        onBytes(chunk.length)
        cb(null, chunk)
      } catch (err) {
        cb(err as Error)
      }
    },
  })
  await pipeline(stream, counter, out)
  return full
}

async function parseMultipartUpload(req: NextRequest, userId: string) {
  const headers: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    headers[key] = value
  })
  const bb = Busboy({
    headers,
    limits: {
      fileSize: MAX_UPLOAD_FILE_BYTES,
      files: 25,
      fields: 50,
      parts: 100,
    },
  })
  const fields: Record<string, string> = {}
  const modelFiles: TempModelFile[] = []
  let coverImageSourceRel: string | undefined
  let totalModelBytes = 0
  let sawModelInput = false
  const fileWrites: Array<Promise<void>> = []
  let failed = false
  let settled = false
  let rejectOnce: (err: Error) => void = () => undefined

  const trackTotalBytes = (bytes: number) => {
    totalModelBytes += bytes
    if (totalModelBytes > MAX_UPLOAD_TOTAL_BYTES) {
      throw uploadError('Upload exceeds total size limit.', 413)
    }
  }

  const fail = (err: Error) => {
    if (failed) return
    failed = true
    bb.destroy(err)
    rejectOnce(err)
  }

  bb.on('field', (name, value) => {
    fields[name] = value
  })

  bb.on('file', (fieldname, file, info) => {
    const filename = info.filename || 'upload.bin'
    const lower = filename.toLowerCase()

    file.on('limit', () => {
      fail(uploadError(`File too large: ${filename}`, 413))
      file.resume()
    })

    if (fieldname === 'image') {
      if (coverImageSourceRel || !isSupportedImageFile(filename, info.mimeType || '')) {
        file.resume()
        return
      }
      const ext = path.extname(filename) || '.bin'
      coverImageSourceRel = path.join(userId, 'uploads', `cover-raw-${Date.now()}${ext}`)
      let imageBytes = 0
      const p: Promise<void> = (async () => {
        try {
          await streamToStorage(coverImageSourceRel!, file, (size) => { imageBytes += size })
          if (imageBytes === 0) {
            throw new Error('Image upload failed')
          }
        } catch (err) {
          console.error('Failed to process cover image:', err)
          coverImageSourceRel = undefined
        }
      })()
      fileWrites.push(p)
      return
    }

    if (fieldname !== 'files' && fieldname !== 'model') {
      file.resume()
      return
    }
    sawModelInput = true

    if (lower.endsWith('.zip')) {
      const p: Promise<void> = (async () => {
        const zipParser = (UnzipperParse as any)({ forceStream: true })
        const zipPromise = pipeline(file, zipParser)
        for await (const entry of zipParser) {
          if (entry.type === 'Directory') {
            entry.autodrain()
            continue
          }
          const entryName = path.basename(entry.path)
          if (!isAllowedModel(entryName)) {
            entry.autodrain()
            continue
          }
          const entrySize = Number(entry.vars?.uncompressedSize || 0)
          if (entrySize && entrySize > MAX_UPLOAD_FILE_BYTES) {
            entry.autodrain()
            throw uploadError(`Zip entry too large: ${entryName}`, 413)
          }
          const ext = path.extname(entryName).toLowerCase() || '.bin'
          const tempRel = buildTempRelPath(userId, entryName)
          const tempFull = path.join(storageRoot(), tempRel)
          const record: TempModelFile = {
            originalName: entryName,
            ext,
            tempRel,
            tempFull,
            size: 0,
          }
          modelFiles.push(record)
          await streamToStorage(tempRel, entry, (size) => {
            record.size += size
            if (record.size > MAX_UPLOAD_FILE_BYTES) {
              throw uploadError(`Zip entry too large: ${entryName}`, 413)
            }
            trackTotalBytes(size)
          })
        }
        await zipPromise
      })()
      fileWrites.push(p)
      return
    }

    if (!isAllowedModel(lower)) {
      file.resume()
      return
    }

    const tempRel = buildTempRelPath(userId, filename)
    const tempFull = path.join(storageRoot(), tempRel)
    const record: TempModelFile = {
      originalName: filename,
      ext: path.extname(filename).toLowerCase() || '.bin',
      tempRel,
      tempFull,
      size: 0,
    }
    modelFiles.push(record)
    const p: Promise<void> = streamToStorage(tempRel, file, (size) => {
      record.size += size
      trackTotalBytes(size)
    }).then(() => undefined).catch((err) => {
      file.destroy(err as Error)
      throw err
    })
    fileWrites.push(p)
  })

  return new Promise<ParsedUpload>((resolve, reject) => {
    rejectOnce = (err) => {
      if (settled) return
      settled = true
      reject(err)
    }

    bb.on('error', (err) => {
      const error = err instanceof Error ? err : new Error(String(err))
      rejectOnce(error)
    })

    bb.on('finish', async () => {
      if (failed) return
      try {
        await Promise.all(fileWrites)
        if (settled) return
        settled = true
        resolve({ fields, modelFiles, coverImageSourceRel, sawModelInput })
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        rejectOnce(error)
      }
    })

    if (!req.body) {
      rejectOnce(new Error('Missing request body'))
      return
    }

    Readable.fromWeb(req.body as any).pipe(bb)
  })
}

async function moveTempFile(tempFull: string, finalRel: string) {
  const finalFull = path.join(storageRoot(), finalRel)
  await ensureDir(path.dirname(finalFull))
  await rename(tempFull, finalFull)
  return finalFull
}

async function cleanupTempFiles(files: TempModelFile[]) {
  await Promise.all(files.map((file) => unlink(file.tempFull).catch(() => undefined)))
}

export async function OPTIONS(req: NextRequest) {
  try {
    const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' }, select: { directUploadUrl: true } })
    const directUploadUrl = cfg?.directUploadUrl || process.env.DIRECT_UPLOAD_URL || null
    const res = new NextResponse(null, { status: 204 })
    return applyPreflightCors(req, res, directUploadUrl)
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}

export async function POST(req: NextRequest) {
  let directUploadUrl: string | null = process.env.DIRECT_UPLOAD_URL || null
  let tempFiles: TempModelFile[] = []
  try {
    // Check site config for anonymous upload policy
    const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' } })
    directUploadUrl = cfg?.directUploadUrl || directUploadUrl
    const json = (body: any, init?: ResponseInit) => jsonWithCors(req, body, init, directUploadUrl)
    const uidFromCookie = await getUserIdFromCookie()
    if (cfg && cfg.allowAnonymousUploads === false && !uidFromCookie) {
      return json({ error: 'Sign in required to upload' }, { status: 401 })
    }
    const userId = uidFromCookie || (await ensureAnonymousUser())
    const uploader = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, profile: { select: { slug: true } } },
    })

    const parsed = await parseMultipartUpload(req, userId)
    tempFiles = parsed.modelFiles
    const title = String(parsed.fields.title || '').slice(0, 200)
    const description = String(parsed.fields.description || '').slice(0, 2000)
    const creditName = String(parsed.fields.creditName || '').slice(0, 200) || null
    const creditUrl = String(parsed.fields.creditUrl || '').slice(0, 500) || null
    const material = String(parsed.fields.material || 'PLA').slice(0, 40)
    const tagsRaw = String(parsed.fields.tags || '')
    const parsePositive = (value: string | undefined) => {
      if (!value) return null
      const numeric = Number(value)
      if (!Number.isFinite(numeric) || numeric <= 0) return null
      return numeric
    }
    const targetDimensions = {
      x: parsePositive(parsed.fields.sizeXmm),
      y: parsePositive(parsed.fields.sizeYmm),
      z: parsePositive(parsed.fields.sizeZmm),
    }
    const hasTargetDimensions = Object.values(targetDimensions).some((val) => val != null)

    const modelFiles = parsed.modelFiles
    if (!parsed.sawModelInput) return json({ error: 'Missing model files' }, { status: 400 })
    if (modelFiles.length === 0) return json({ error: 'No valid model files found' }, { status: 400 })

    let coverImageRel: string | undefined
    const coverImageSourceRel = parsed.coverImageSourceRel
    if (coverImageSourceRel) {
      // Store cover images under userId/thumbnails as consistent webp assets
      coverImageRel = path.join(userId, 'thumbnails', `${Date.now()}-${safeName(title) || 'cover'}.webp`)
    }

    // Save files and create model + parts
    const now = Date.now()
    const isMultipart = modelFiles.length > 1
    const applyTargetDimensions = hasTargetDimensions && !isMultipart
    let totalVolMm3 = 0
    let totalPrice = 0
    let totalSupportRatio: number | null = null
    const partCreates: any[] = []
    const previewJobs: Array<{ sourcePath: string, previewPath: string, partIndex: number }> = []
    const partVolumes: Array<number | null> = []
    let firstPath: string | null = null
    let firstViewerPath: string | null = null
    const storedExts: string[] = []
    let overallSizeXmm: number | undefined
    let overallSizeYmm: number | undefined
    let overallSizeZmm: number | undefined

    for (let i = 0; i < modelFiles.length; i++) {
      const f = modelFiles[i]
      const storedExt = f.ext
      let queuedPreviewPath: string | null = null
      let previewRel: string | null = null
      if (storedExt === '.3mf') {
        previewRel = path.join(userId, 'models', `${now}-${safeName(title) || 'model'}-${i + 1}-preview.stl`)
        queuedPreviewPath = `/${previewRel.replace(/\\/g, '/')}`
      }

      const rel = path.join(userId, 'models', `${now}-${safeName(title) || 'model'}-${i + 1}${storedExt}`)
      const storedFull = await moveTempFile(f.tempFull, rel)
      const storedPath = `/${rel.replace(/\\/g, '/')}`
      storedExts.push(storedExt.replace('.', '').toUpperCase())
      if (!firstPath) firstPath = storedPath
      let previewPath: string | null = storedExt === '.stl' ? storedPath : null
      let statsBuf: Buffer | null = null
      let storedBuf: Buffer | null = null
      if (storedExt === '.stl' || storedExt === '.3mf') {
        storedBuf = await readFile(storedFull)
      }
      if (storedExt === '.stl' && storedBuf) {
        statsBuf = storedBuf
      }
      if (storedExt === '.3mf' && storedBuf && previewRel) {
        try {
          const converted = await convert3mfToStl(storedBuf)
          if (converted) {
            await saveBuffer(previewRel, converted.buf)
            previewPath = `/${previewRel.replace(/\\/g, '/')}`
            statsBuf = converted.buf
          }
        } catch (err) {
          console.warn('Inline 3MF conversion failed, deferring to queue', err)
        }
      }
      const viewerPath = previewPath || storedPath
      if (!firstViewerPath && viewerPath) firstViewerPath = viewerPath
      let volMm3: number | null = null
      let sizeXmm: number | undefined, sizeYmm: number | undefined, sizeZmm: number | undefined
      let supportRatio: number | null = null
      if (statsBuf) {
        let stats = computeStlStatsMm(statsBuf)
        if (applyTargetDimensions) {
          stats = scaleStatsToTargetDimensions(stats, targetDimensions)
        }
        volMm3 = stats.volumeMm3
        sizeXmm = stats.sizeXmm; sizeYmm = stats.sizeYmm; sizeZmm = stats.sizeZmm
        if (stats.supportAreaRatio != null && Number.isFinite(Number(stats.supportAreaRatio))) {
          supportRatio = Number(stats.supportAreaRatio)
        }
        if (!isMultipart) {
          if (sizeXmm != null) overallSizeXmm = sizeXmm
          if (sizeYmm != null) overallSizeYmm = sizeYmm
          if (sizeZmm != null) overallSizeZmm = sizeZmm
        }
      } else if (applyTargetDimensions) {
        if (targetDimensions.x != null) sizeXmm = targetDimensions.x
        if (targetDimensions.y != null) sizeYmm = targetDimensions.y
        if (targetDimensions.z != null) sizeZmm = targetDimensions.z
        if (sizeXmm != null) overallSizeXmm = sizeXmm
        if (sizeYmm != null) overallSizeYmm = sizeYmm
        if (sizeZmm != null) overallSizeZmm = sizeZmm
      }
      const cm3 = volMm3 ? volMm3 / 1000 : null
      const p = cm3 != null
        ? estimatePriceUSD({ cm3, material, supportRatio, cfg, applyMinimum: !isMultipart })
        : null
      if (volMm3) totalVolMm3 += volMm3
      if (p) totalPrice += p
      partVolumes.push(volMm3)
      partCreates.push({
        name: f.originalName,
        index: i,
        filePath: storedPath,
        previewFilePath: previewPath || undefined,
        volumeMm3: volMm3 || undefined,
        sizeXmm,
        sizeYmm,
        sizeZmm,
        supportRatio: supportRatio ?? undefined,
        priceUsd: p || undefined
      })
      if (storedExt === '.3mf' && queuedPreviewPath && !previewPath) {
        previewJobs.push({ sourcePath: storedPath, previewPath: queuedPreviewPath, partIndex: i })
      }
    }

    if (isMultipart && totalVolMm3 > 0) {
      let weightedSupport = 0
      let weightedVolume = 0
      partCreates.forEach((part, idx) => {
        const vol = partVolumes[idx]
        if (!vol || !Number.isFinite(vol)) return
        if (part.supportRatio == null || !Number.isFinite(Number(part.supportRatio))) return
        weightedSupport += Number(part.supportRatio) * vol
        weightedVolume += vol
      })
      if (weightedVolume > 0) {
        totalSupportRatio = weightedSupport / weightedVolume
      }
      const totalWithMinimum = estimatePriceUSD({
        cm3: totalVolMm3 / 1000,
        material,
        supportRatio: totalSupportRatio,
        cfg,
        applyMinimum: true,
      })
      totalPrice = totalWithMinimum
      partCreates.forEach((part, idx) => {
        const vol = partVolumes[idx]
        if (!vol || !Number.isFinite(vol)) return
        part.priceUsd = Number(((totalWithMinimum * vol) / totalVolMm3).toFixed(2))
      })
    } else if (partCreates.length === 1) {
      totalSupportRatio = partCreates[0].supportRatio ?? null
    }

    const effectivePriceUsd = resolveModelPricing({
      volumeMm3: totalVolMm3 || null,
      material,
      supportRatio: totalSupportRatio,
      priceUsd: totalPrice || null,
      salePriceUsd: null,
    }, cfg).priceUsd

    const created = await prisma.model.create({
      data: {
        userId,
        title,
        description,
        creditName: creditName || undefined,
        creditUrl: creditUrl || undefined,
        material,
        filePath: firstPath!,
        viewerFilePath: firstViewerPath || firstPath!,
        fileType: modelFiles.length > 1 ? 'MULTI' : (storedExts[0] || path.extname(modelFiles[0].originalName).replace('.', '').toUpperCase()),
        volumeMm3: totalVolMm3 || undefined,
        sizeXmm: overallSizeXmm,
        sizeYmm: overallSizeYmm,
        sizeZmm: overallSizeZmm,
        supportRatio: totalSupportRatio ?? undefined,
        priceUsd: totalPrice || undefined,
        effectivePriceUsd: effectivePriceUsd ?? undefined,
        effectivePriceUpdatedAt: effectivePriceUsd != null ? new Date() : undefined,
        coverImagePath: coverImageRel ? `/${coverImageRel.replace(/\\/g, '/')}` : undefined,
        coverImageStatus: coverImageRel ? 'processing' : undefined,
        coverImageSourcePath: coverImageSourceRel ? `/${coverImageSourceRel.replace(/\\/g, '/')}` : undefined,
        modelTags: tagsRaw ? { create: await prepareTags(tagsRaw) } : undefined,
        parts: { create: partCreates }
      },
      include: { parts: true }
    })
    if (previewJobs.length > 0) {
      try {
        for (const job of previewJobs) {
          const part = created.parts.find((entry) => entry.index === job.partIndex)
          if (!part) continue
          await enqueueModelPreviewJob({
            modelId: created.id,
            partId: part.id,
            sourcePath: job.sourcePath,
            previewPath: job.previewPath,
          })
        }
      } catch (err) {
        console.warn('Failed to queue 3MF preview job', err)
      }
    }
    if (coverImageSourceRel) {
      try {
        await processPendingImages(1, { modelId: created.id })
      } catch (err) {
        console.warn('Failed to process cover image', err)
      }
    }
    if (previewJobs.length > 0) {
      try {
        await processPendingModelPreviews(previewJobs.length, { modelId: created.id })
      } catch (err) {
        console.warn('Failed to process 3MF previews', err)
      }
    }
    try { await refreshUserAchievements(prisma, userId) } catch {}
    try {
      const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
      const uploaderLabel = uploader?.name || uploader?.email || 'anonymous'
      const profileUrl = uploader?.profile?.slug ? `${baseUrl}/u/${uploader.profile.slug}` : undefined
      await sendAdminDiscordNotification({
        title: 'New upload',
        body: [
          `Title: ${title || '(untitled)'}`,
          `By: ${uploaderLabel}`,
          profileUrl ? `Profile: ${profileUrl}` : null,
          `${baseUrl}/models/${created.id}`,
        ],
        meta: {
          modelId: created.id,
          files: modelFiles.length,
          types: storedExts.length ? storedExts.join(', ') : undefined,
        },
      })
    } catch (notifyErr) {
      console.error('Admin Discord notification failed for upload:', notifyErr)
    }
    try {
      const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
      const uploaderLabel = uploader?.name || uploader?.email || 'anonymous'
      await sendAdminPushNotification({
        title: 'New model uploaded',
        body: `${title || '(untitled)'} by ${uploaderLabel}`,
        url: `${baseUrl}/admin`,
        tag: `model:${created.id}`,
        data: { modelId: created.id },
      })
    } catch (notifyErr) {
      console.error('Admin push notification failed for upload:', notifyErr)
    }
    return json({ model: created })
  } catch (e: any) {
    console.error('Upload failed:', e)
    if (tempFiles.length > 0) {
      await cleanupTempFiles(tempFiles)
    }
    const status = e?.status && Number.isFinite(e.status) ? Number(e.status) : 400
    return jsonWithCors(req, { error: e.message || 'Upload failed' }, { status }, directUploadUrl)
  }
}

function safeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function ensureAnonymousUser(): Promise<string> {
  // Create a stable anonymous user to attach uploads when not logged in
  const anonEmail = 'anonymous@local'
  const existing = await prisma.user.findUnique({ where: { email: anonEmail } })
  if (existing) return existing.id
  const created = await prisma.user.create({ data: { email: anonEmail, passwordHash: '!', emailVerified: true, isSuspended: false } })
  return created.id
}

async function prepareTags(tagsRaw: string) {
  const { prisma } = await import('@/lib/db')
  const { slugify } = await import('@/lib/userpage')
  const names = Array.from(new Set(tagsRaw.split(',').map(t => t.trim()).filter(Boolean))).slice(0, 12)
  const result: any[] = []
  for (const name of names) {
    const slug = slugify(name)
    let tag = await prisma.tag.findUnique({ where: { slug } })
    if (!tag) {
      try {
        tag = await prisma.tag.create({ data: { name, slug } })
      } catch {
        tag = await prisma.tag.findUnique({ where: { slug } })
      }
    }
    if (tag) result.push({ tag: { connect: { id: tag.id } } })
  }
  return result
}

