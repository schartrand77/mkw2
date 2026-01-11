import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import path from 'path'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { saveBuffer } from '@/lib/storage'
import { computeStlStatsMm } from '@/lib/stl'
import JSZip from 'jszip'
import { estimatePriceUSD, resolveModelPricing } from '@/lib/pricing'
import { refreshUserAchievements } from '@/lib/achievements'
import { isSupportedImageFile } from '@/lib/images'
import { sendAdminDiscordNotification } from '@/lib/discord'
import { sendAdminPushNotification } from '@/lib/push'
import { enqueueModelPreviewJob } from '@/lib/model-preview-queue'

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

function getZipEntrySize(entry: JSZip.JSZipObject): number | null {
  const data = (entry as any)?._data
  const size = data?.uncompressedSize ?? data?.compressedSize
  return Number.isFinite(size) ? Number(size) : null
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

    const form = await req.formData()
    const title = String(form.get('title') || '').slice(0, 200)
    const description = String(form.get('description') || '').slice(0, 2000)
    const creditName = ((form.get('creditName') as string) || '').slice(0, 200) || null
    const creditUrl = ((form.get('creditUrl') as string) || '').slice(0, 500) || null
    const material = String(form.get('material') || 'PLA').slice(0, 40)
    const files = form.getAll('files') as File[]
    const model = (form.get('model') as File | null) // legacy single file field
    const tagsRaw = (form.get('tags') as string | null) || ''
    const image = form.get('image') as File | null

    // Collect candidate model files (support zip or multiple file inputs)
    const modelFiles: { name: string, buf: Buffer }[] = []
    const inputs = files && files.length > 0 ? files : (model ? [model] : [])
    if (!inputs || inputs.length === 0) return json({ error: 'Missing model files' }, { status: 400 })
    const inputBytes = inputs.reduce((sum, file) => sum + (file?.size || 0), 0)
    if (inputBytes > MAX_UPLOAD_TOTAL_BYTES) {
      return json({ error: 'Upload exceeds total size limit.' }, { status: 413 })
    }

    let extractedBytes = 0
    for (const f of inputs) {
      const lower = f.name.toLowerCase()
      if (f.size > MAX_UPLOAD_FILE_BYTES) {
        return json({ error: `File too large: ${f.name}` }, { status: 413 })
      }
      const ab = await f.arrayBuffer()
      const buf = Buffer.from(ab)
      if (lower.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(buf)
        const entries = Object.values(zip.files)
        for (const entry of entries) {
          if (entry.dir) continue
          const ename = entry.name
          if (!isAllowedModel(ename)) continue
          const entrySize = getZipEntrySize(entry)
          if (entrySize && entrySize > MAX_UPLOAD_FILE_BYTES) {
            return json({ error: `Zip entry too large: ${path.basename(ename)}` }, { status: 413 })
          }
          const ebuf = await entry.async('nodebuffer')
          extractedBytes += entrySize || ebuf.length
          if (extractedBytes > MAX_UPLOAD_TOTAL_BYTES) {
            return json({ error: 'Upload exceeds total size limit.' }, { status: 413 })
          }
          modelFiles.push({ name: path.basename(ename), buf: ebuf })
        }
      } else if (isAllowedModel(lower)) {
        extractedBytes += buf.length
        if (extractedBytes > MAX_UPLOAD_TOTAL_BYTES) {
          return json({ error: 'Upload exceeds total size limit.' }, { status: 413 })
        }
        modelFiles.push({ name: f.name, buf })
      }
    }

    if (modelFiles.length === 0) return json({ error: 'No valid model files found' }, { status: 400 })

    let coverImageRel: string | undefined
    let coverImageSourceRel: string | undefined
    if (image && isSupportedImageFile(image.name, image.type)) {
      try {
        const imgBuf = Buffer.from(await image.arrayBuffer())
        if (imgBuf.length === 0) {
          throw new Error('Image upload failed')
        }
        const ext = path.extname(image.name) || '.bin'
        coverImageSourceRel = path.join(userId, 'uploads', `cover-raw-${Date.now()}${ext}`)
        await saveBuffer(coverImageSourceRel, imgBuf)
        // Store cover images under userId/thumbnails as consistent webp assets
        coverImageRel = path.join(userId, 'thumbnails', `${Date.now()}-${safeName(title) || 'cover'}.webp`)
      } catch (err) {
        console.error('Failed to process cover image:', err)
      }
    }

    // Save files and create model + parts
    const now = Date.now()
    const isMultipart = modelFiles.length > 1
    let totalVolMm3 = 0
    let totalPrice = 0
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
      const ext = path.extname(f.name).toLowerCase()
      const storedExt = ext
      const storedBuf = f.buf
      let previewBuf: Buffer | null = null
      let previewExt: string | null = null
      let queuedPreviewPath: string | null = null
      if (storedExt === '.3mf') {
        const previewRel = path.join(userId, 'models', `${now}-${safeName(title) || 'model'}-${i + 1}-preview.stl`)
        queuedPreviewPath = `/${previewRel.replace(/\\/g, '/')}`
      }

      const rel = path.join(userId, 'models', `${now}-${safeName(title) || 'model'}-${i + 1}${storedExt}`)
      await saveBuffer(rel, storedBuf)
      const storedPath = `/${rel.replace(/\\/g, '/')}`
      storedExts.push(storedExt.replace('.', '').toUpperCase())
      if (!firstPath) firstPath = storedPath
      let previewPath: string | null = storedExt === '.stl' ? storedPath : null
      if (previewBuf && previewExt) {
        const previewRel = path.join(userId, 'models', `${now}-${safeName(title) || 'model'}-${i + 1}-preview${previewExt}`)
        await saveBuffer(previewRel, previewBuf)
        previewPath = `/${previewRel.replace(/\\/g, '/')}`
      }
      const viewerPath = previewPath || storedPath
      if (!firstViewerPath && viewerPath) firstViewerPath = viewerPath
      let volMm3: number | null = null
      let sizeXmm: number | undefined, sizeYmm: number | undefined, sizeZmm: number | undefined
      const statsBuf = previewBuf || (storedExt === '.stl' ? storedBuf : null)
      if (statsBuf) {
        const stats = computeStlStatsMm(statsBuf)
        volMm3 = stats.volumeMm3
        sizeXmm = stats.sizeXmm; sizeYmm = stats.sizeYmm; sizeZmm = stats.sizeZmm
        if (!isMultipart && sizeXmm != null && sizeYmm != null && sizeZmm != null) {
          overallSizeXmm = sizeXmm
          overallSizeYmm = sizeYmm
          overallSizeZmm = sizeZmm
        }
      }
      const cm3 = volMm3 ? volMm3 / 1000 : null
      const p = cm3 != null ? estimatePriceUSD({ cm3, material, cfg, applyMinimum: !isMultipart }) : null
      if (volMm3) totalVolMm3 += volMm3
      if (p) totalPrice += p
      partVolumes.push(volMm3)
      partCreates.push({
        name: f.name,
        index: i,
        filePath: storedPath,
        previewFilePath: previewPath || undefined,
        volumeMm3: volMm3 || undefined,
        sizeXmm,
        sizeYmm,
        sizeZmm,
        priceUsd: p || undefined
      })
      if (storedExt === '.3mf' && queuedPreviewPath) {
        previewJobs.push({ sourcePath: storedPath, previewPath: queuedPreviewPath, partIndex: i })
      }
    }

    if (isMultipart && totalVolMm3 > 0) {
      const totalWithMinimum = estimatePriceUSD({ cm3: totalVolMm3 / 1000, material, cfg, applyMinimum: true })
      totalPrice = totalWithMinimum
      partCreates.forEach((part, idx) => {
        const vol = partVolumes[idx]
        if (!vol || !Number.isFinite(vol)) return
        part.priceUsd = Number(((totalWithMinimum * vol) / totalVolMm3).toFixed(2))
      })
    }

    const effectivePriceUsd = resolveModelPricing({
      volumeMm3: totalVolMm3 || null,
      material,
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
        fileType: modelFiles.length > 1 ? 'MULTI' : (storedExts[0] || path.extname(modelFiles[0].name).replace('.', '').toUpperCase()),
        volumeMm3: totalVolMm3 || undefined,
        sizeXmm: overallSizeXmm,
        sizeYmm: overallSizeYmm,
        sizeZmm: overallSizeZmm,
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
    return jsonWithCors(req, { error: e.message || 'Upload failed' }, { status: 400 }, directUploadUrl)
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

