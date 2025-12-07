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

  const [total, models, cfg] = await Promise.all([
    prisma.model.count({ where }),
    prisma.model.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
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
      }
    }),
    prisma.siteConfig.findUnique({ where: { id: 'main' } })
  ])
  const mapped = (models as ModelWithPartsCountAndTags[]).map(m => {
    const summary = resolveModelPricing(m, cfg)
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
