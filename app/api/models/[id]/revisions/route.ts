import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import JSZip from 'jszip'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { saveBuffer } from '@/lib/storage'
import { computeStlStatsMm } from '@/lib/stl'
import { estimatePriceUSD, resolveModelPricing } from '@/lib/pricing'
import { enqueueModelPreviewJob, processPendingModelPreviews } from '@/lib/model-preview-queue'

export const dynamic = 'force-dynamic'

type ModelRevisionContext = { params: Promise<{ id: string }> }

const isAllowedModel = (name: string) => /\.(stl|obj|3mf)$/i.test(name)

const MAX_UPLOAD_FILE_BYTES = readByteEnv('UPLOAD_MAX_FILE_BYTES', 100 * 1024 * 1024)
const MAX_UPLOAD_TOTAL_BYTES = readByteEnv('UPLOAD_MAX_TOTAL_BYTES', 200 * 1024 * 1024)

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

async function guardModelEditor(modelId: string) {
  const userId = await getUserIdFromCookie()
  if (!userId) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const [model, me] = await Promise.all([
    prisma.model.findUnique({ where: { id: modelId }, select: { id: true, userId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }),
  ])
  if (!model) return { response: NextResponse.json({ error: 'Model not found' }, { status: 404 }) }
  if (model.userId !== userId && !me?.isAdmin) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { model, userId }
}

export async function GET(_req: NextRequest, { params }: ModelRevisionContext) {
  const { id } = await params
  const guard = await guardModelEditor(id)
  if ('response' in guard) return guard.response
  const revisions = await prisma.modelRevision.findMany({
    where: { modelId: id },
    orderBy: { createdAt: 'desc' },
    include: { parts: { orderBy: { index: 'asc' } }, user: { select: { id: true, name: true } } },
  })
  return NextResponse.json({ revisions })
}

export async function POST(req: NextRequest, { params }: ModelRevisionContext) {
  const { id } = await params
  const guard = await guardModelEditor(id)
  if ('response' in guard) return guard.response

  const [cfg, modelInfo] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    prisma.model.findUnique({ where: { id }, select: { material: true } }),
  ])
  const materialChoice = modelInfo?.material || 'PLA'

  const form = await req.formData()
  const note = String(form.get('note') || '').slice(0, 2000) || null
  const files = form.getAll('files') as File[]
  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'Missing model files' }, { status: 400 })
  }
  const inputBytes = files.reduce((sum, file) => sum + (file?.size || 0), 0)
  if (inputBytes > MAX_UPLOAD_TOTAL_BYTES) {
    return NextResponse.json({ error: 'Upload exceeds total size limit.' }, { status: 413 })
  }

  const modelFiles: { name: string, buf: Buffer }[] = []
  let extractedBytes = 0
  for (const f of files) {
    const lower = f.name.toLowerCase()
    if (f.size > MAX_UPLOAD_FILE_BYTES) {
      return NextResponse.json({ error: `File too large: ${f.name}` }, { status: 413 })
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
          return NextResponse.json({ error: `Zip entry too large: ${path.basename(ename)}` }, { status: 413 })
        }
        const ebuf = await entry.async('nodebuffer')
        extractedBytes += entrySize || ebuf.length
        if (extractedBytes > MAX_UPLOAD_TOTAL_BYTES) {
          return NextResponse.json({ error: 'Upload exceeds total size limit.' }, { status: 413 })
        }
        modelFiles.push({ name: path.basename(ename), buf: ebuf })
      }
    } else if (isAllowedModel(lower)) {
      extractedBytes += buf.length
      if (extractedBytes > MAX_UPLOAD_TOTAL_BYTES) {
        return NextResponse.json({ error: 'Upload exceeds total size limit.' }, { status: 413 })
      }
      modelFiles.push({ name: f.name, buf })
    }
  }
  if (modelFiles.length === 0) {
    return NextResponse.json({ error: 'No valid model files found' }, { status: 400 })
  }

  const now = Date.now()
  const isMultipart = modelFiles.length > 1
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
    const ext = path.extname(f.name).toLowerCase()
    const storedExt = ext
    const storedBuf = f.buf
    let previewBuf: Buffer | null = null
    let previewExt: string | null = null
    let queuedPreviewPath: string | null = null
    if (storedExt === '.3mf') {
      const previewRel = path.join(guard.userId, 'models', `${now}-${i + 1}-preview.stl`)
      queuedPreviewPath = `/${previewRel.replace(/\\/g, '/')}`
    }

    const rel = path.join(guard.userId, 'models', `${now}-${f.name.replace(/[^a-z0-9_.-]+/gi, '-')}-${i + 1}${storedExt}`)
    await saveBuffer(rel, storedBuf)
    const storedPath = `/${rel.replace(/\\/g, '/')}`
    storedExts.push(storedExt.replace('.', '').toUpperCase())
    if (!firstPath) firstPath = storedPath
    let previewPath: string | null = storedExt === '.stl' ? storedPath : null
    if (previewBuf && previewExt) {
      const previewRel = path.join(guard.userId, 'models', `${now}-${i + 1}-preview${previewExt}`)
      await saveBuffer(previewRel, previewBuf)
      previewPath = `/${previewRel.replace(/\\/g, '/')}`
    }
    const viewerPath = previewPath || storedPath
    if (!firstViewerPath && viewerPath) firstViewerPath = viewerPath
    let volMm3: number | null = null
    let sizeXmm: number | undefined, sizeYmm: number | undefined, sizeZmm: number | undefined
    let supportRatio: number | null = null
    const statsBuf = previewBuf || (storedExt === '.stl' ? storedBuf : null)
    if (statsBuf) {
      const stats = computeStlStatsMm(statsBuf)
      volMm3 = stats.volumeMm3
      sizeXmm = stats.sizeXmm; sizeYmm = stats.sizeYmm; sizeZmm = stats.sizeZmm
      if (stats.supportAreaRatio != null && Number.isFinite(Number(stats.supportAreaRatio))) {
        supportRatio = Number(stats.supportAreaRatio)
      }
      if (!isMultipart && sizeXmm != null && sizeYmm != null && sizeZmm != null) {
        overallSizeXmm = sizeXmm
        overallSizeYmm = sizeYmm
        overallSizeZmm = sizeZmm
      }
    }
    const cm3 = volMm3 ? volMm3 / 1000 : null
    const p = cm3 != null
      ? estimatePriceUSD({ cm3, material: materialChoice, supportRatio, cfg, applyMinimum: !isMultipart })
      : null
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
      supportRatio: supportRatio ?? undefined,
      priceUsd: p || undefined,
    })
    if (storedExt === '.3mf' && queuedPreviewPath) {
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
      material: materialChoice,
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

  const revisionCount = await prisma.modelRevision.count({ where: { modelId: id } })
  const version = revisionCount + 1

  const effectivePriceUsd = resolveModelPricing({
    volumeMm3: totalVolMm3 || null,
    material: materialChoice,
    supportRatio: totalSupportRatio,
    priceUsd: totalPrice || null,
    salePriceUsd: null,
  }, cfg).priceUsd

  const created = await prisma.$transaction(async (tx) => {
    await tx.modelPart.deleteMany({ where: { modelId: id } })
    await tx.modelPart.createMany({ data: partCreates.map((part) => ({ ...part, modelId: id })) })
    await tx.model.update({
      where: { id },
      data: {
        filePath: firstPath!,
        viewerFilePath: firstViewerPath || firstPath!,
        fileType: modelFiles.length > 1 ? 'MULTI' : (storedExts[0] || path.extname(modelFiles[0].name).replace('.', '').toUpperCase()),
        volumeMm3: totalVolMm3 || undefined,
        sizeXmm: overallSizeXmm,
        sizeYmm: overallSizeYmm,
        sizeZmm: overallSizeZmm,
        supportRatio: totalSupportRatio ?? undefined,
        priceUsd: totalPrice || undefined,
        effectivePriceUsd: effectivePriceUsd ?? undefined,
        effectivePriceUpdatedAt: effectivePriceUsd != null ? new Date() : undefined,
      },
    })
    return tx.modelRevision.create({
      data: {
        modelId: id,
        userId: guard.userId,
        label: modelFiles[0].name || `Revision ${version}`,
        note,
        filePath: firstPath!,
        viewerFilePath: firstViewerPath || firstPath!,
        fileType: modelFiles.length > 1 ? 'MULTI' : (storedExts[0] || path.extname(modelFiles[0].name).replace('.', '').toUpperCase()),
        version,
        parts: {
          create: partCreates.map((part) => ({
            name: part.name,
            index: part.index,
            filePath: part.filePath,
            previewFilePath: part.previewFilePath,
            volumeMm3: part.volumeMm3,
            sizeXmm: part.sizeXmm,
            sizeYmm: part.sizeYmm,
            sizeZmm: part.sizeZmm,
          })),
        },
      },
      include: { parts: true },
    })
  })

  if (previewJobs.length > 0) {
    try {
      const parts = await prisma.modelPart.findMany({ where: { modelId: id }, select: { id: true, index: true } })
      for (const job of previewJobs) {
        const part = parts.find((entry) => entry.index === job.partIndex)
        if (!part) continue
        await enqueueModelPreviewJob({
          modelId: id,
          partId: part.id,
          sourcePath: job.sourcePath,
          previewPath: job.previewPath,
        })
      }
    } catch (err) {
      console.warn('Failed to queue 3MF preview job', err)
    }
    try {
      await processPendingModelPreviews(previewJobs.length, { modelId: id })
    } catch (err) {
      console.warn('Failed to process 3MF previews', err)
    }
  }

  return NextResponse.json({ revision: created })
}
