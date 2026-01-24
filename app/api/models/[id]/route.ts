import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readFile, unlink } from 'fs/promises'
export const dynamic = 'force-dynamic'
import { getUserIdFromCookie } from '@/lib/auth'
import { saveBuffer, storageRoot } from '@/lib/storage'
import path from 'path'
import { serializeModelImages } from '@/lib/model-images'
import { revalidatePath } from 'next/cache'
import { resolveModelPricing, estimatePricingDetails } from '@/lib/pricing'
import { computeEffectivePriceUsd } from '@/lib/pricing-cache'
import { extractAmazonAsin, buildAmazonImageUrl } from '@/lib/amazon'
import { commentInclude, findVerifiedCommentUserIds, serializeComment } from '@/lib/comments'
import { computeStlStatsMm } from '@/lib/stl'
import { updateModelPricingForModel } from '@/lib/model-pricing'
import { processPendingImages } from '@/lib/image-queue'
import { scaleStatsToTargetDimensions } from '@/lib/model-dimensions'

type ModelRouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: ModelRouteContext) {
  const { id } = await params
  let model = await prisma.model.findUnique({
    where: { id },
    include: {
      modelTags: { include: { tag: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      comments: commentInclude,
      revisions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { id: true, name: true } }, parts: { select: { id: true } } },
      },
    },
  })
  if (!model) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  let [parts, cfg] = await Promise.all([
    prisma.modelPart.findMany({ where: { modelId: id }, orderBy: { index: 'asc' } }),
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
  ])
  const partsNeedingStats = parts.filter((part: any) => part.previewFilePath && part.volumeMm3 == null)
  if (partsNeedingStats.length > 0) {
    for (const part of partsNeedingStats) {
      const previewRel = String(part.previewFilePath || '').replace(/^\/+/, '')
      if (!previewRel) continue
      try {
        const buf = await readFile(path.join(storageRoot(), previewRel))
        let stats = computeStlStatsMm(buf)
        stats = scaleStatsToTargetDimensions(stats, {
          x: model.sizeXmm ?? null,
          y: model.sizeYmm ?? null,
          z: model.sizeZmm ?? null,
        })
        if (stats.volumeMm3 != null) {
          await prisma.modelPart.update({
            where: { id: part.id },
            data: {
              volumeMm3: stats.volumeMm3 || undefined,
              sizeXmm: stats.sizeXmm ?? undefined,
              sizeYmm: stats.sizeYmm ?? undefined,
              sizeZmm: stats.sizeZmm ?? undefined,
              supportRatio: stats.supportAreaRatio ?? undefined,
            },
          })
        }
      } catch {
        // ignore missing preview stats
      }
    }
    if (model.viewerFilePath === model.filePath) {
      const firstPreview = parts.find((part: any) => part.index === 0 && part.previewFilePath)?.previewFilePath
      if (firstPreview) {
        await prisma.model.update({ where: { id }, data: { viewerFilePath: firstPreview } })
      }
    }
    await updateModelPricingForModel(id)
    model = await prisma.model.findUnique({
      where: { id },
      include: {
        modelTags: { include: { tag: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        comments: commentInclude,
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { id: true, name: true } }, parts: { select: { id: true } } },
        },
      },
    })
    if (!model) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    parts = await prisma.modelPart.findMany({ where: { modelId: id }, orderBy: { index: 'asc' } })
    cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' } })
  }
  const has3mf = parts.some((part) => String(part.filePath || '').toLowerCase().endsWith('.3mf'))
  const previewJobsPending = has3mf
    ? await prisma.modelPreviewJob.count({
        where: { modelId: id, status: { in: ['pending', 'processing'] } },
      })
    : 0
  let supportRatio = model.supportRatio
  if (supportRatio == null || !Number.isFinite(Number(supportRatio))) {
    let weightedSupport = 0
    let weightedVolume = 0
    for (const part of parts) {
      if (part.volumeMm3 == null || !Number.isFinite(Number(part.volumeMm3))) continue
      if (part.supportRatio == null || !Number.isFinite(Number(part.supportRatio))) continue
      const vol = Number(part.volumeMm3)
      weightedSupport += Number(part.supportRatio) * vol
      weightedVolume += vol
    }
    if (weightedVolume > 0) {
      supportRatio = weightedSupport / weightedVolume
    }
  }
  const tags = model.modelTags.map(mt => ({ id: mt.tag.id, name: mt.tag.name, slug: mt.tag.slug }))
  const { modelTags, images, comments, revisions, coverImageSourcePath, coverImageError, ...rest } = model as any
  const pricingSummary = resolveModelPricing(model as any, cfg)
  const effectivePriceUsd = model.effectivePriceUsd != null && Number.isFinite(Number(model.effectivePriceUsd))
    ? Number(model.effectivePriceUsd)
    : null
  const displayPriceUsd = pricingSummary.salePriceUsd ?? effectivePriceUsd ?? pricingSummary.priceUsd
  const totalVolumeMm3 = model.volumeMm3 != null && Number.isFinite(Number(model.volumeMm3)) ? Number(model.volumeMm3) : null
  const totalPricing = totalVolumeMm3 != null
    ? estimatePricingDetails({
      cm3: totalVolumeMm3 / 1000,
      material: rest.material,
      supportRatio: supportRatio ?? null,
      cfg,
      applyMinimum: true,
    })
    : null
  let affiliateImage: string | null = null
  if (rest.affiliateUrl) {
    const asin = extractAmazonAsin(rest.affiliateUrl)
    if (asin) affiliateImage = buildAmazonImageUrl(asin)
  }
  const verifiedComments = await findVerifiedCommentUserIds(model.id, (comments || []).map((c: any) => c.userId))
  const isMultipart = parts.length > 1
  return NextResponse.json({
    model: {
      ...rest,
      previewProcessing: has3mf ? previewJobsPending > 0 : false,
      priceUsd: displayPriceUsd,
      basePriceUsd: pricingSummary.basePriceUsd,
      salePriceUsd: pricingSummary.salePriceUsd,
      pricing: pricingSummary.breakdown,
      affiliateImage,
      tags,
      parts: parts.map((part) => {
        const rawPrice = part.priceUsd != null ? Number(part.priceUsd) : null
        const partPricing = part.volumeMm3 != null && Number.isFinite(Number(part.volumeMm3))
          ? estimatePricingDetails({
            cm3: Number(part.volumeMm3) / 1000,
            material: rest.material,
            supportRatio: part.supportRatio ?? null,
            cfg,
            applyMinimum: false,
          })
          : null
        const computedPrice = isMultipart && totalPricing && totalVolumeMm3 && part.volumeMm3 && totalVolumeMm3 > 0
          ? Number(((totalPricing.price * Number(part.volumeMm3)) / totalVolumeMm3).toFixed(2))
          : ((rawPrice != null && Number.isFinite(rawPrice)) ? rawPrice : (partPricing?.price ?? null))
        return {
          ...part,
          priceUsd: computedPrice,
          pricing: partPricing,
        }
      }),
      images: serializeModelImages(images),
      comments: (comments || []).map((comment: any) => serializeComment({
        ...comment,
        isVerified: comment.userId ? verifiedComments.has(comment.userId) : false,
      })),
      revisions: (revisions || []).map((rev: any) => ({
        id: rev.id,
        version: rev.version,
        label: rev.label,
        note: rev.note,
        createdAt: rev.createdAt,
        user: rev.user ? { id: rev.user.id, name: rev.user.name } : null,
        partsCount: Array.isArray(rev.parts) ? rev.parts.length : 0,
      })),
    },
  })
}

export async function PATCH(req: NextRequest, { params }: ModelRouteContext) {
  const { id } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.model.findUnique({
    where: { id },
    select: {
      userId: true,
      coverImagePath: true,
      volumeMm3: true,
      material: true,
      supportRatio: true,
      priceUsd: true,
      salePriceUsd: true,
    },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Allow owner or admin
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  if (existing.userId !== userId && !me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ct = req.headers.get('content-type') || ''
  let title: string | undefined
  let description: string | undefined
  let material: string | undefined
  let removeCover = false
  let image: File | null = null

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData()
    title = (form.get('title') as string | null) || undefined
    description = (form.get('description') as string | null) || undefined
    material = (form.get('material') as string | null) || undefined
    const rc = (form.get('removeCover') as string | null) || 'false'
    removeCover = rc === '1' || rc === 'true'
    image = (form.get('cover') as File | null) || null
  } else {
    try {
      const json = await req.json()
      title = typeof json.title === 'string' ? json.title : undefined
      description = typeof json.description === 'string' ? json.description : undefined
      material = typeof json.material === 'string' ? json.material : undefined
      removeCover = json.removeCover === true
    } catch {
      // ignore
    }
  }

  const updates: any = {}
  if (title != null) updates.title = String(title).slice(0, 200)
  if (description != null) updates.description = String(description).slice(0, 5000)
  if (material != null) updates.material = String(material).slice(0, 40)

  if (removeCover && existing.coverImagePath) {
    try { await unlink(path.join(storageRoot(), existing.coverImagePath.replace(/^\/+/, ''))) } catch {}
    updates.coverImagePath = null
  }

  if (image) {
    const buf = Buffer.from(await image.arrayBuffer())
    if (buf.length === 0) {
      return NextResponse.json({ error: 'Image upload failed' }, { status: 400 })
    }
    const ext = path.extname(image.name) || '.bin'
    const sourceRel = path.join(userId, 'uploads', `cover-raw-${Date.now()}${ext}`)
    await saveBuffer(sourceRel, buf)
    const rel = path.join(userId, 'thumbnails', `${Date.now()}-cover.webp`)
    if (existing.coverImagePath) {
      try { await unlink(path.join(storageRoot(), existing.coverImagePath.replace(/^\/+/, ''))) } catch {}
    }
    updates.coverImagePath = `/${rel.replace(/\\/g, '/')}`
    updates.coverImageStatus = 'processing'
    updates.coverImageSourcePath = `/${sourceRel.replace(/\\/g, '/')}`
  }

  if (material != null) {
    const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' } })
    const effectivePriceUsd = computeEffectivePriceUsd({
      id,
      volumeMm3: existing.volumeMm3,
      material: updates.material ?? existing.material,
      supportRatio: existing.supportRatio,
      priceUsd: existing.priceUsd,
      salePriceUsd: existing.salePriceUsd,
    }, cfg)
    updates.effectivePriceUsd = effectivePriceUsd
    updates.effectivePriceUpdatedAt = new Date()
  }

  const updated = await prisma.model.update({ where: { id }, data: updates })
  if (image) {
    try {
      await processPendingImages(1, { modelId: id })
    } catch (err) {
      console.warn('Failed to process cover image', err)
    }
  }
  try {
    revalidatePath(`/models/${id}`)
    revalidatePath('/discover')
    revalidatePath('/')
  } catch {
    // ignore revalidation errors
  }
  return NextResponse.json({ model: updated })
}
