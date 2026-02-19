import type { Collection, Prisma } from '@prisma/client'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { resolveModelPricing } from '@/lib/pricing'
import type { DiscoverModel } from '@/types/discover'
import { CACHE_TAGS, CACHE_TTL_SECONDS } from '@/lib/cache-policy'

type CollectionWithModels = Collection & {
  models: {
    position: number
    model: {
      id: string
      title: string
      coverImagePath: string | null
      sizeXmm: number | null
      sizeYmm: number | null
      sizeZmm: number | null
      fileType: string | null
      priceUsd: number | null
      salePriceUsd: number | null
      salePriceIsFrom: boolean
      salePriceUnit: string | null
      volumeMm3: number | null
      material: string
      likes: number
      downloads: number
      createdAt: Date
      updatedAt: Date
      _count: { parts: number; comments: number }
    }
  }[]
}

const buildActiveCollectionWhere = (): Prisma.CollectionWhereInput => {
  const now = new Date()
  return {
    isActive: true,
    OR: [
      { startsAt: null },
      { startsAt: { lte: now } },
    ],
    AND: [
      {
        OR: [
          { endsAt: null },
          { endsAt: { gte: now } },
        ],
      },
    ],
  }
}

const MODEL_SELECT = {
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
  _count: { select: { parts: true, comments: true } },
} satisfies Prisma.ModelSelect

export type CollectionSummary = Pick<Collection, 'id' | 'slug' | 'title' | 'description' | 'kind' | 'materialKey' | 'heroImagePath'>

export async function listActiveCollections(limit = 6): Promise<CollectionSummary[]> {
  return unstable_cache(async () => (
    prisma.collection.findMany({
      where: buildActiveCollectionWhere(),
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        kind: true,
        materialKey: true,
        heroImagePath: true,
      },
    })
  ), [`active-collections:${limit}`], {
    revalidate: CACHE_TTL_SECONDS.collections,
    tags: [CACHE_TAGS.collections],
  })()
}

export async function getCollectionBySlug(slug: string): Promise<Collection | null> {
  if (!slug) return null
  return prisma.collection.findFirst({
    where: { slug, ...buildActiveCollectionWhere() },
  })
}

function mapToDiscoverModel(model: any, cfg: any): DiscoverModel {
  const summary = resolveModelPricing(model, cfg)
  return {
    id: model.id,
    title: model.title,
    coverImagePath: model.coverImagePath,
    sizeXmm: model.sizeXmm,
    sizeYmm: model.sizeYmm,
    sizeZmm: model.sizeZmm,
    fileType: model.fileType,
    priceUsd: summary.priceUsd,
    basePriceUsd: summary.basePriceUsd,
    salePriceUsd: summary.salePriceUsd,
    saleActive: summary.saleActive,
    salePriceIsFrom: model.salePriceIsFrom,
    salePriceUnit: model.salePriceUnit ?? null,
    likes: model.likes,
    downloads: model.downloads,
    commentsCount: model._count?.comments || 0,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    partsCount: model._count?.parts || 0,
  }
}

export async function getCollectionModels(collection: Collection, limit = 24): Promise<DiscoverModel[]> {
  const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' } })
  if (collection.kind === 'material_popular' && collection.materialKey) {
    const models = await prisma.model.findMany({
      where: { visibility: 'public', material: collection.materialKey },
      orderBy: [{ downloads: 'desc' }, { likes: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
      select: MODEL_SELECT,
    })
    return models.map((model) => mapToDiscoverModel(model, cfg))
  }

  const withModels = await prisma.collection.findUnique({
    where: { id: collection.id },
    select: {
      id: true,
      models: {
        orderBy: { position: 'asc' },
        take: limit,
        select: {
          position: true,
          model: { select: MODEL_SELECT },
        },
      },
    },
  }) as CollectionWithModels | null

  if (!withModels) return []
  return withModels.models.map((entry) => mapToDiscoverModel(entry.model, cfg))
}
