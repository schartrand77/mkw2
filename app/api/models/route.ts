import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { resolveModelPricing } from '@/lib/pricing'
import { DiscoverSort, type ModelWithPartsCountAndTags } from '@/types/discover'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || undefined
  const material = searchParams.get('material')?.trim() || undefined
  const sort = (searchParams.get('sort') || DiscoverSort.Latest) as DiscoverSort
  const tagsParam = searchParams.get('tags')?.trim() || undefined
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(60, Math.max(1, parseInt(searchParams.get('pageSize') || '24', 10) || 24))

  let where: Prisma.ModelWhereInput = { visibility: 'public' }
  if (q) {
    where = {
      ...where,
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    }
  }
  if (material) {
    where = { ...where, material }
  }
  if (tagsParam) {
    const slugs = Array.from(new Set(tagsParam.split(',').map(s => s.trim()).filter(Boolean)))
    if (slugs.length) {
      // ANY of the tags
      where = {
        ...where,
        modelTags: { some: { tag: { slug: { in: slugs } } } }
      }
    }
  }

  const orderBy: Prisma.ModelOrderByWithRelationInput | Prisma.ModelOrderByWithRelationInput[] = (() => {
    switch (sort) {
      case DiscoverSort.PriceAsc:
        return [{ salePriceUsd: 'asc' as const }, { priceUsd: 'asc' }] as any
      case DiscoverSort.PriceDesc:
        return [{ salePriceUsd: 'desc' as const }, { priceUsd: 'desc' }] as any
      case DiscoverSort.Popular:
        return [{ likes: 'desc' }, { downloads: 'desc' }, { createdAt: 'desc' }] as any
      case DiscoverSort.Latest:
      default:
        return { createdAt: 'desc' }
    }
  })()

  const modelSelect = {
    id: true,
    title: true,
    coverImagePath: true,
    sizeXmm: true,
    sizeYmm: true,
    sizeZmm: true,
    fileType: true,
    priceUsd: true,
    salePriceUsd: true,
    salePriceIsFrom: true,
    salePriceUnit: true,
    volumeMm3: true,
    material: true,
    likes: true,
    downloads: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { parts: true } },
    modelTags: { include: { tag: true } }
  } satisfies Prisma.ModelSelect

  const skip = (page - 1) * pageSize
  const wantsPriceSort = sort === DiscoverSort.PriceAsc || sort === DiscoverSort.PriceDesc
  const summariesById = new Map<string, ReturnType<typeof resolveModelPricing>>()

  const totalPromise = prisma.model.count({ where })
  const cfgPromise = prisma.siteConfig.findUnique({ where: { id: 'main' } })
  let models: ModelWithPartsCountAndTags[] = []
  let total = 0
  let cfg: Awaited<ReturnType<typeof prisma.siteConfig.findUnique>> = null

  if (wantsPriceSort) {
    const priceCandidatesPromise = prisma.model.findMany({
      where,
      select: {
        id: true,
        priceUsd: true,
        salePriceUsd: true,
        volumeMm3: true,
        material: true,
        updatedAt: true,
      },
    })
    const [resolvedTotal, resolvedCfg, priceCandidates] = await Promise.all([totalPromise, cfgPromise, priceCandidatesPromise])
    total = resolvedTotal
    cfg = resolvedCfg
    const sortedByPrice: PriceSortEntry[] = priceCandidates
      .map(candidate => ({
        id: candidate.id,
        updatedAt: candidate.updatedAt,
        summary: resolveModelPricing(candidate, cfg),
      }))
      .sort((a, b) => compareByEffectivePrice(a, b, sort as DiscoverSort.PriceAsc | DiscoverSort.PriceDesc))
    const pageEntries = sortedByPrice.slice(skip, skip + pageSize)
    pageEntries.forEach(entry => summariesById.set(entry.id, entry.summary))
    const pageIds = pageEntries.map(entry => entry.id)
    if (pageIds.length) {
      const pageModels = await prisma.model.findMany({
        where: { id: { in: pageIds } },
        select: modelSelect,
      }) as ModelWithPartsCountAndTags[]
      const ordered = new Map(pageModels.map(model => [model.id, model]))
      models = pageIds
        .map(id => ordered.get(id))
        .filter((model): model is ModelWithPartsCountAndTags => Boolean(model))
    }
  } else {
    const modelsPromise = prisma.model.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: modelSelect,
    })
    const [resolvedTotal, resolvedCfg, fetchedModels] = await Promise.all([totalPromise, cfgPromise, modelsPromise])
    total = resolvedTotal
    cfg = resolvedCfg
    models = fetchedModels as ModelWithPartsCountAndTags[]
  }

  const mapped = models.map(m => {
    const summary = summariesById.get(m.id) ?? resolveModelPricing(m, cfg)
    return {
      id: m.id,
      title: m.title,
      coverImagePath: m.coverImagePath,
      sizeXmm: m.sizeXmm,
      sizeYmm: m.sizeYmm,
      sizeZmm: m.sizeZmm,
      fileType: m.fileType,
      priceUsd: summary.priceUsd,
      basePriceUsd: summary.basePriceUsd,
      salePriceUsd: summary.salePriceUsd,
      saleActive: summary.saleActive,
      salePriceIsFrom: m.salePriceIsFrom,
      salePriceUnit: m.salePriceUnit ?? null,
      likes: m.likes,
      downloads: m.downloads,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      partsCount: m._count?.parts || 0,
      tags: m.modelTags?.map(mt => ({ id: mt.tag.id, name: mt.tag.name, slug: mt.tag.slug })) || []
    }
  })
  return NextResponse.json({ models: mapped, total, page, pageSize })
}

function compareByEffectivePrice(
  a: PriceSortEntry,
  b: PriceSortEntry,
  sort: DiscoverSort.PriceAsc | DiscoverSort.PriceDesc,
) {
  const direction = sort === DiscoverSort.PriceAsc ? 1 : -1
  const mapNull = sort === DiscoverSort.PriceAsc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
  const priceA = typeof a.summary.priceUsd === 'number' ? a.summary.priceUsd : null
  const priceB = typeof b.summary.priceUsd === 'number' ? b.summary.priceUsd : null
  const safeA = priceA ?? mapNull
  const safeB = priceB ?? mapNull
  if (safeA === safeB) {
    return b.updatedAt.getTime() - a.updatedAt.getTime()
  }
  return safeA > safeB ? direction : -direction
}

type PriceSortEntry = {
  id: string
  updatedAt: Date
  summary: ReturnType<typeof resolveModelPricing>
}
