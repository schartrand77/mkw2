import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { estimatePrice } from '@/lib/pricing'
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
            volumeMm3: true,
          },
        },
      },
      take: 24,
    }),
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
  ])
  const models = items.map(({ model }) => {
    const computedPrice = (() => {
      if (model.volumeMm3) {
        const cm3 = model.volumeMm3 / 1000
        return estimatePrice({ cm3, material: model.material, cfg })
      }
      return model.priceUsd
    })()
    return {
      ...model,
      priceUsd: computedPrice,
    }
  })
  return NextResponse.json({ models })
}
