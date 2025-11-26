import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { resolveModelPricing } from '@/lib/pricing'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || undefined
  const material = searchParams.get('material')?.trim() || undefined
  const sort = (searchParams.get('sort') || 'latest') as 'latest' | 'popular' | 'price_asc' | 'price_desc'
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
      case 'price_asc':
        return [{ salePriceUsd: 'asc' as const }, { priceUsd: 'asc' }] as any
      case 'price_desc':
        return [{ salePriceUsd: 'desc' as const }, { priceUsd: 'desc' }] as any
      case 'popular':
        return [{ likes: 'desc' }, { downloads: 'desc' }, { createdAt: 'desc' }] as any
      case 'latest':
      default:
        return { createdAt: 'desc' }
    }
  })()

  const [total, models, cfg] = await Promise.all([
    prisma.model.count({ where }),
    prisma.model.findMany({
      where,
      orderBy: orderBy as any,
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
  const mapped = models.map(m => {
    const summary = resolveModelPricing(m as any, cfg)
    return {
      id: m.id,
      title: m.title,
      coverImagePath: m.coverImagePath,
      sizeXmm: (m as any).sizeXmm,
      sizeYmm: (m as any).sizeYmm,
      sizeZmm: (m as any).sizeZmm,
      fileType: (m as any).fileType,
      priceUsd: summary.priceUsd,
      basePriceUsd: summary.basePriceUsd,
      salePriceUsd: summary.salePriceUsd,
      saleActive: summary.saleActive,
      salePriceIsFrom: Boolean((m as any).salePriceIsFrom),
      salePriceUnit: (m as any).salePriceUnit ?? null,
      likes: m.likes,
      downloads: m.downloads,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      partsCount: (m as any)._count?.parts || 0,
      tags: (m as any).modelTags?.map((mt: any) => ({ id: mt.tag.id, name: mt.tag.name, slug: mt.tag.slug })) || []
    }
  })
  return NextResponse.json({ models: mapped, total, page, pageSize })
}
