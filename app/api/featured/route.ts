import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolveModelPricing } from '@/lib/pricing'
export const dynamic = 'force-dynamic'

export async function GET() {
  const [items, cfg] = await Promise.all([
    prisma.featuredModel.findMany({
      where: { model: { visibility: 'public' } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        model: {
          select: {
            id: true,
            title: true,
            coverImagePath: true,
            material: true,
            priceUsd: true,
            salePriceUsd: true,
            volumeMm3: true,
            updatedAt: true,
          },
        },
      },
      take: 24,
    }),
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
  ])
  const models = items.map(({ model }) => {
    const summary = resolveModelPricing(model as any, cfg)
    return {
      ...model,
      priceUsd: summary.priceUsd,
      basePriceUsd: summary.basePriceUsd,
      salePriceUsd: summary.salePriceUsd,
      saleActive: summary.saleActive,
    }
  })
  return NextResponse.json({ models })
}
