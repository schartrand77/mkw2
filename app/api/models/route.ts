import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { DiscoverEntityType, DiscoverSort, type ModelWithPartsCountAndTags } from '@/types/discover'

type DiscoverScope = 'models' | 'products' | 'merch'

function parseDiscoverQuery(rawQuery: string | null): { text: string | undefined; scopes: Set<DiscoverScope> } {
  const raw = (rawQuery || '').trim()
  if (!raw) return { text: undefined, scopes: new Set<DiscoverScope>() }
  const tokens = raw.split(/\s+/).filter(Boolean)
  const scopes = new Set<DiscoverScope>()
  const textTokens: string[] = []
  for (const token of tokens) {
    const normalized = token.toLowerCase()
    if (!normalized.startsWith('#')) {
      textTokens.push(token)
      continue
    }
    const tag = normalized.replace(/^#+/, '')
    if (['model', 'models', 'print', 'prints'].includes(tag)) {
      scopes.add('models')
      continue
    }
    if (['product', 'products', 'template', 'templates'].includes(tag)) {
      scopes.add('products')
      continue
    }
    if (['merch', 'apparel', 'swag'].includes(tag)) {
      scopes.add('merch')
      continue
    }
    textTokens.push(token)
  }
  const text = textTokens.join(' ').trim()
  return { text: text || undefined, scopes }
}

function resolvePriceSortValue(price: number | null | undefined, sort: DiscoverSort) {
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    return sort === DiscoverSort.PriceDesc ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
  }
  return price
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const parsedQuery = parseDiscoverQuery(searchParams.get('q'))
  const q = parsedQuery.text
  const material = searchParams.get('material')?.trim() || undefined
  const sort = (searchParams.get('sort') || DiscoverSort.Latest) as DiscoverSort
  const tagsParam = searchParams.get('tags')?.trim() || undefined
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(60, Math.max(1, parseInt(searchParams.get('pageSize') || '24', 10) || 24))
  const shouldSearchAllScopes = Boolean(searchParams.get('q')?.trim())
  const scopes = shouldSearchAllScopes
    ? (parsedQuery.scopes.size > 0 ? parsedQuery.scopes : new Set<DiscoverScope>(['models', 'products', 'merch']))
    : new Set<DiscoverScope>(['models'])

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
        return [{ effectivePriceUsd: 'asc' }, { updatedAt: 'desc' }]
      case DiscoverSort.PriceDesc:
        return [{ effectivePriceUsd: 'desc' }, { updatedAt: 'desc' }]
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
    effectivePriceUsd: true,
    salePriceUsd: true,
    salePriceIsFrom: true,
    salePriceUnit: true,
    flatRatePricing: true,
    colorSlotCount: true,
    allowedColors: true,
    likes: true,
    downloads: true,
    createdAt: true,
    updatedAt: true,
    defaultColors: true,
    _count: { select: { parts: true, comments: true } },
    modelTags: { include: { tag: true } }
  } satisfies Prisma.ModelSelect

  const skip = (page - 1) * pageSize
  const fetchModels = scopes.has('models')
    ? prisma.model.findMany({
      where,
      orderBy: shouldSearchAllScopes ? undefined : orderBy,
      skip: shouldSearchAllScopes ? 0 : skip,
      take: shouldSearchAllScopes ? undefined : pageSize,
      select: modelSelect,
    }) as Promise<ModelWithPartsCountAndTags[]>
    : Promise.resolve([])

  const productWhere: Prisma.ProductTemplateWhereInput = {
    isActive: true,
    ...(q
      ? {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { baseModel: { title: { contains: q, mode: 'insensitive' } } },
        ],
      }
      : {}),
  }
  const merchWhere: Prisma.MerchItemWhereInput = {
    isActive: true,
    ...(q
      ? {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      }
      : {}),
  }
  const fetchProducts = scopes.has('products')
    ? prisma.productTemplate.findMany({
      where: productWhere,
      include: {
        baseModel: {
          select: {
            id: true,
            title: true,
            coverImagePath: true,
            sizeXmm: true,
            sizeYmm: true,
            sizeZmm: true,
            priceUsd: true,
            effectivePriceUsd: true,
            salePriceUsd: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
    : Promise.resolve([])
  const fetchMerch = scopes.has('merch')
    ? prisma.merchItem.findMany({
      where: merchWhere,
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    })
    : Promise.resolve([])
  const fetchModelTotal = scopes.has('models') ? prisma.model.count({ where }) : Promise.resolve(0)
  const fetchProductTotal = scopes.has('products') ? prisma.productTemplate.count({ where: productWhere }) : Promise.resolve(0)
  const fetchMerchTotal = scopes.has('merch') ? prisma.merchItem.count({ where: merchWhere }) : Promise.resolve(0)

  const [models, products, merch, modelTotal, productTotal, merchTotal] = await Promise.all([
    fetchModels,
    fetchProducts,
    fetchMerch,
    fetchModelTotal,
    fetchProductTotal,
    fetchMerchTotal,
  ])

  const mappedModels = models.map((m) => {
    const basePriceUsd = m.priceUsd != null && Number.isFinite(Number(m.priceUsd)) ? Number(m.priceUsd) : null
    const salePriceUsd = m.salePriceUsd != null && Number.isFinite(Number(m.salePriceUsd)) ? Number(m.salePriceUsd) : null
    const effectivePriceUsd = m.effectivePriceUsd != null && Number.isFinite(Number(m.effectivePriceUsd)) ? Number(m.effectivePriceUsd) : null
    const priceUsd = salePriceUsd ?? effectivePriceUsd ?? basePriceUsd
    const saleActive = salePriceUsd != null && basePriceUsd != null ? salePriceUsd < basePriceUsd : false
    return {
      id: m.id,
      entityType: DiscoverEntityType.Model,
      href: `/models/${m.id}`,
      title: m.title,
      coverImagePath: m.coverImagePath,
      sizeXmm: m.sizeXmm,
      sizeYmm: m.sizeYmm,
      sizeZmm: m.sizeZmm,
      fileType: m.fileType,
      priceUsd,
      basePriceUsd,
      salePriceUsd,
      saleActive,
      salePriceIsFrom: m.salePriceIsFrom,
      salePriceUnit: m.salePriceUnit ?? null,
      flatRatePricing: Boolean((m as any).flatRatePricing),
      colorSlotCount: typeof (m as any).colorSlotCount === 'number' ? (m as any).colorSlotCount : null,
      allowedColors: Array.isArray((m as any).allowedColors) ? (m as any).allowedColors : null,
      likes: m.likes,
      downloads: m.downloads,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      partsCount: m._count?.parts || 0,
      commentsCount: m._count?.comments || 0,
      defaultColors: Array.isArray((m as any).defaultColors) ? (m as any).defaultColors : null,
      tags: m.modelTags?.map((mt) => ({ id: mt.tag.id, name: mt.tag.name, slug: mt.tag.slug })) || [],
    }
  })
  const mappedProducts = products.map((p) => {
    const baseModelPrice = p.baseModel?.salePriceUsd ?? p.baseModel?.effectivePriceUsd ?? p.baseModel?.priceUsd ?? null
    return {
      id: p.id,
      entityType: DiscoverEntityType.Product,
      href: `/products/${p.id}`,
      title: p.title,
      coverImagePath: p.baseModel?.coverImagePath ?? null,
      fileType: 'Product',
      priceUsd: baseModelPrice,
      likes: 0,
      downloads: 0,
      sizeXmm: p.baseModel?.sizeXmm ?? null,
      sizeYmm: p.baseModel?.sizeYmm ?? null,
      sizeZmm: p.baseModel?.sizeZmm ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }
  })
  const mappedMerch = merch.map((entry) => ({
    id: entry.id,
    entityType: DiscoverEntityType.Merch,
    href: `/products/${entry.id}?kind=merch`,
    title: entry.title,
    coverImagePath: entry.imageUrl,
    fileType: 'Merch',
    priceUsd: entry.priceUsd,
    likes: 0,
    downloads: 0,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }))

  if (!shouldSearchAllScopes) {
    return NextResponse.json({ models: mappedModels, total: modelTotal, page, pageSize })
  }

  const combined = [...mappedModels, ...mappedProducts, ...mappedMerch]
  combined.sort((a, b) => {
    if (sort === DiscoverSort.PriceAsc || sort === DiscoverSort.PriceDesc) {
      const aPrice = resolvePriceSortValue(a.priceUsd, sort)
      const bPrice = resolvePriceSortValue(b.priceUsd, sort)
      if (aPrice !== bPrice) return sort === DiscoverSort.PriceAsc ? aPrice - bPrice : bPrice - aPrice
    } else if (sort === DiscoverSort.Popular) {
      const aScore = (a.likes || 0) + (a.downloads || 0)
      const bScore = (b.likes || 0) + (b.downloads || 0)
      if (aScore !== bScore) return bScore - aScore
    }
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0
    if (aCreated !== bCreated) return bCreated - aCreated
    return String(a.title || '').localeCompare(String(b.title || ''))
  })

  const total = modelTotal + productTotal + merchTotal
  const paged = combined.slice(skip, skip + pageSize)
  return NextResponse.json({ models: paged, total, page, pageSize })
}
