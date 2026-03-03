import { prisma } from '@/lib/db'

export type ModelLineageSummary = {
  origin: {
    id: string
    title: string
    slug: string | null
    creatorName: string | null
  } | null
  remixes: Array<{
    id: string
    title: string
    slug: string | null
    creatorName: string | null
    createdAt: Date
  }>
}

function extractInternalModelId(creditUrl?: string | null) {
  if (!creditUrl || typeof creditUrl !== 'string') return null
  const match = creditUrl.match(/\/models\/([a-z0-9]+)/i)
  return match?.[1] || null
}

export async function getModelLineageSummary(modelId: string, creditUrl?: string | null): Promise<ModelLineageSummary> {
  const sourceModelId = extractInternalModelId(creditUrl)

  const [origin, remixes] = await Promise.all([
    sourceModelId && sourceModelId !== modelId
      ? prisma.model.findUnique({
          where: { id: sourceModelId },
          select: {
            id: true,
            title: true,
            user: { select: { name: true, profile: { select: { slug: true } } } },
          },
        })
      : Promise.resolve(null),
    prisma.model.findMany({
      where: {
        id: { not: modelId },
        creditUrl: { contains: `/models/${modelId}` },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        title: true,
        createdAt: true,
        user: { select: { name: true, profile: { select: { slug: true } } } },
      },
    }),
  ])

  return {
    origin: origin
      ? {
          id: origin.id,
          title: origin.title,
          slug: origin.user?.profile?.slug || null,
          creatorName: origin.user?.name || null,
        }
      : null,
    remixes: remixes.map((model) => ({
      id: model.id,
      title: model.title,
      slug: model.user?.profile?.slug || null,
      creatorName: model.user?.name || null,
      createdAt: model.createdAt,
    })),
  }
}
