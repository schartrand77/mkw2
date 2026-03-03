import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { DiscoverEntityType, DiscoverSort, type ModelWithPartsCountAndTags } from '@/types/discover'
import { getMaterialAvailabilitySnapshot, normalizeAvailabilityMaterialKey } from '@/lib/material-availability'

export const dynamic = 'force-dynamic'

type DiscoverScope = 'models' | 'products' | 'merch'

function recommendationScoreForModel(model: {
  title: string
  description?: string | null
  material?: string | null
  printabilityScore?: number | null
  failureRiskScore?: number | null
  downloads?: number | null
  likes?: number | null
  tags?: string[]
  availability?: string | null
}, query: { text?: string; materials: string[]; tags: string[] }) {
  let score = 0
  const reasons: string[] = []
  const queryText = (query.text || '').trim().toLowerCase()
  const title = (model.title || '').toLowerCase()
  const description = (model.description || '').toLowerCase()
  const material = (model.material || '').toLowerCase()
  const tags = (model.tags || []).map((tag) => tag.toLowerCase())

  if (queryText) {
    if (title.includes(queryText)) {
      score += 45
      reasons.push('Title match')
    } else if (description.includes(queryText)) {
      score += 20
      reasons.push('Description match')
    }
  }
  if (query.materials.some((entry) => material === entry.toLowerCase())) {
    score += 20
    reasons.push('Material match')
  }
  if (query.tags.some((entry) => tags.includes(entry.toLowerCase()))) {
    score += 18
    reasons.push('Tag match')
  }
  if ((model.availability || '') === 'in_stock') {
    score += 8
  }
  if (typeof model.printabilityScore === 'number') {
    score += Math.max(0, Math.min(12, model.printabilityScore / 10))
  }
  if (typeof model.failureRiskScore === 'number') {
    score += Math.max(0, Math.min(10, (100 - model.failureRiskScore) / 10))
  }
  if (typeof model.downloads === 'number' && model.downloads > 0) {
    score += Math.min(8, Math.log10(model.downloads + 1) * 4)
  }
  if (typeof model.likes === 'number' && model.likes > 0) {
    score += Math.min(6, Math.log10(model.likes + 1) * 4)
  }
  return {
    score: Math.round(score),
    reasons: Array.from(new Set(reasons)).slice(0, 3),
  }
}

function parseDiscoverQuery(rawQuery: string | null): {
  text: string | undefined
  scopes: Set<DiscoverScope>
  materials: string[]
  tags: string[]
} {
  const raw = (rawQuery || '').trim()
  if (!raw) return { text: undefined, scopes: new Set<DiscoverScope>(), materials: [], tags: [] }
  const tokens = raw.split(/\s+/).filter(Boolean)
  const scopes = new Set<DiscoverScope>()
  const materials = new Set<string>()
  const tags = new Set<string>()
  const textTokens: string[] = []
  for (const token of tokens) {
    const normalized = token.toLowerCase()
    if (normalized.startsWith('material:')) {
      const value = token.slice(token.indexOf(':') + 1).trim()
      if (value) materials.add(value)
      continue
    }
    if (normalized.startsWith('tag:') || normalized.startsWith('tags:')) {
      const value = token.slice(token.indexOf(':') + 1).trim().replace(/^#+/, '')
      if (value) tags.add(value.toLowerCase())
      continue
    }
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
  return { text: text || undefined, scopes, materials: Array.from(materials), tags: Array.from(tags) }
}

function resolvePriceSortValue(price: number | null | undefined, sort: DiscoverSort) {
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    return sort === DiscoverSort.PriceDesc ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
  }
  return price
}

function resolveAvailabilityRank(value?: string | null) {
  if (value === 'in_stock') return 0
  if (value === 'limited') return 1
  if (value === 'unknown') return 2
  return 3
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const parsedQuery = parseDiscoverQuery(searchParams.get('q'))
  const q = parsedQuery.text
  const materialParam = searchParams.get('material')?.trim() || undefined
  const readyToPrint = searchParams.get('ready') === '1'
  const sort = (searchParams.get('sort') || DiscoverSort.Latest) as DiscoverSort
  const tagsParam = searchParams.get('tags')?.trim() || undefined
  const materialFilters = Array.from(new Set([materialParam, ...parsedQuery.materials].map((value) => value?.trim()).filter(Boolean))) as string[]
  const tagFilters = Array.from(new Set([
    ...parsedQuery.tags,
    ...(tagsParam ? tagsParam.split(',').map((value) => value.trim().toLowerCase()) : []),
  ].filter(Boolean)))
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(60, Math.max(1, parseInt(searchParams.get('pageSize') || '24', 10) || 24))
  const customModelSort = [DiscoverSort.BestConfidence, DiscoverSort.FastestToShip, DiscoverSort.LowestFailureRisk].includes(sort)
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
  if (materialFilters.length === 1) {
    where = { ...where, material: materialFilters[0] }
  } else if (materialFilters.length > 1) {
    where = { ...where, material: { in: materialFilters } }
  }
  if (readyToPrint) {
    where = {
      ...where,
      AND: [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { priceUsd: { not: null } },
        { printabilityScore: { gte: 70 } },
        { failureRiskScore: { lte: 35 } },
        {
          OR: [
            { supportLikelihood: null },
            { supportLikelihood: { lte: 0.45 } },
          ],
        },
      ],
    }
  }
  if (tagFilters.length) {
    where = {
      ...where,
      modelTags: { some: { tag: { slug: { in: tagFilters } } } }
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
    description: true,
    material: true,
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
    printabilityScore: true,
    failureRiskScore: true,
    supportLikelihood: true,
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
      orderBy: shouldSearchAllScopes || customModelSort ? undefined : orderBy,
      skip: shouldSearchAllScopes || readyToPrint || customModelSort ? 0 : skip,
      take: shouldSearchAllScopes || readyToPrint || customModelSort ? undefined : pageSize,
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

  const materialAvailability = await getMaterialAvailabilitySnapshot(models.map((entry) => entry.material || 'PLA'))

  const mappedModels = models.map((m) => {
    const basePriceUsd = m.priceUsd != null && Number.isFinite(Number(m.priceUsd)) ? Number(m.priceUsd) : null
    const salePriceUsd = m.salePriceUsd != null && Number.isFinite(Number(m.salePriceUsd)) ? Number(m.salePriceUsd) : null
    const effectivePriceUsd = m.effectivePriceUsd != null && Number.isFinite(Number(m.effectivePriceUsd)) ? Number(m.effectivePriceUsd) : null
    const priceUsd = salePriceUsd ?? effectivePriceUsd ?? basePriceUsd
    const saleActive = salePriceUsd != null && basePriceUsd != null ? salePriceUsd < basePriceUsd : false
    const availabilityKey = normalizeAvailabilityMaterialKey(m.material || 'PLA')
    const availability = materialAvailability.materials[availabilityKey]
    const recommendation = recommendationScoreForModel({
      title: m.title,
      description: (m as any).description || '',
      material: m.material,
      printabilityScore: m.printabilityScore ?? null,
      failureRiskScore: m.failureRiskScore ?? null,
      downloads: m.downloads,
      likes: m.likes,
      tags: m.modelTags?.map((mt) => mt.tag.slug) || [],
      availability: availability?.status ?? null,
    }, {
      text: q,
      materials: materialFilters,
      tags: tagFilters,
    })
    return {
      id: m.id,
      entityType: DiscoverEntityType.Model,
      href: `/models/${m.id}`,
      title: m.title,
      material: m.material,
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
      printabilityScore: m.printabilityScore ?? null,
      failureRiskScore: m.failureRiskScore ?? null,
      supportLikelihood: m.supportLikelihood ?? null,
      materialAvailability: availability?.status ?? (materialAvailability.enabled ? 'unknown' : null),
      materialLeadTimeDays: availability?.leadTimeDays ?? null,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      partsCount: m._count?.parts || 0,
      commentsCount: m._count?.comments || 0,
      defaultColors: Array.isArray((m as any).defaultColors) ? (m as any).defaultColors : null,
      tags: m.modelTags?.map((mt) => ({ id: mt.tag.id, name: mt.tag.name, slug: mt.tag.slug })) || [],
      recommendationScore: recommendation.score,
      recommendationReasons: recommendation.reasons,
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

  const readyFilteredModels = readyToPrint
    ? mappedModels.filter((model) => model.materialAvailability === 'in_stock')
    : mappedModels

  const sortedModels = [...readyFilteredModels].sort((a, b) => {
    if (sort === DiscoverSort.BestConfidence) {
      const aScore = (a.printabilityScore ?? 0) - (a.failureRiskScore ?? 100)
      const bScore = (b.printabilityScore ?? 0) - (b.failureRiskScore ?? 100)
      if (aScore !== bScore) return bScore - aScore
      return resolveAvailabilityRank(a.materialAvailability) - resolveAvailabilityRank(b.materialAvailability)
    }
    if (sort === DiscoverSort.FastestToShip) {
      const availabilityDiff = resolveAvailabilityRank(a.materialAvailability) - resolveAvailabilityRank(b.materialAvailability)
      if (availabilityDiff !== 0) return availabilityDiff
      const aRisk = a.failureRiskScore ?? 100
      const bRisk = b.failureRiskScore ?? 100
      if (aRisk !== bRisk) return aRisk - bRisk
      return (b.printabilityScore ?? 0) - (a.printabilityScore ?? 0)
    }
    if (sort === DiscoverSort.LowestFailureRisk) {
      const aRisk = a.failureRiskScore ?? 100
      const bRisk = b.failureRiskScore ?? 100
      if (aRisk !== bRisk) return aRisk - bRisk
      return (b.printabilityScore ?? 0) - (a.printabilityScore ?? 0)
    }
    return 0
  })

  if (!shouldSearchAllScopes) {
    const baseModels = customModelSort ? sortedModels : readyFilteredModels
    const pagedModels = (readyToPrint || customModelSort) ? baseModels.slice(skip, skip + pageSize) : baseModels
    const totalForResponse = (readyToPrint || customModelSort) ? baseModels.length : modelTotal
    return NextResponse.json({
      models: pagedModels,
      total: totalForResponse,
      page,
      pageSize,
      stockworks: {
        enabled: materialAvailability.enabled,
        updatedAt: materialAvailability.updatedAt || null,
      },
    })
  }

  const combined = [...(customModelSort ? sortedModels : readyFilteredModels), ...mappedProducts, ...mappedMerch]
  combined.sort((a, b) => {
    const aRecommendation = typeof (a as any).recommendationScore === 'number' ? Number((a as any).recommendationScore) : 0
    const bRecommendation = typeof (b as any).recommendationScore === 'number' ? Number((b as any).recommendationScore) : 0
    if (q && aRecommendation !== bRecommendation) return bRecommendation - aRecommendation
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
