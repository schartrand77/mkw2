import { Prisma } from '@prisma/client'
import type { PrismaClient, SiteConfig } from '@prisma/client'
import { resolveModelPricing } from '@/lib/pricing'

type PricingCacheModel = {
  id: string
  volumeMm3: number | null
  material: string | null
  priceUsd: number | null
  salePriceUsd: number | null
  supportRatio?: number | null
}

export function computeEffectivePriceUsd(
  model: PricingCacheModel,
  cfg?: Partial<SiteConfig> | null,
): number | null {
  const summary = resolveModelPricing(model, cfg)
  return typeof summary.priceUsd === 'number' ? summary.priceUsd : null
}

export async function refreshEffectivePrices(
  prisma: PrismaClient,
  cfg?: Partial<SiteConfig> | null,
) {
  const batchSize = 200
  let cursor: string | undefined
  const now = new Date()

  while (true) {
    const models = await prisma.model.findMany({
      select: {
        id: true,
        volumeMm3: true,
        material: true,
        priceUsd: true,
        salePriceUsd: true,
        supportRatio: true,
      },
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: batchSize,
    })
    if (!models.length) break

    const pricingById = models.map((model) => ({
      id: model.id,
      price: computeEffectivePriceUsd(model, cfg),
    }))

    const caseClauses = Prisma.join(
      pricingById.map((entry) => Prisma.sql`WHEN ${entry.id} THEN ${entry.price}`),
      ' ',
    )
    const ids = Prisma.join(pricingById.map((entry) => entry.id))

    await prisma.$executeRaw`
      UPDATE "Model"
      SET "effectivePriceUsd" = CASE "id"
        ${caseClauses}
        ELSE "effectivePriceUsd"
      END,
      "effectivePriceUpdatedAt" = ${now}
      WHERE "id" IN (${ids})
    `

    cursor = models[models.length - 1].id
  }
}
