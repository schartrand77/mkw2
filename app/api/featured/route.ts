import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolveModelPrice } from '@/lib/pricing'
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
            priceOverrideUsd: true,
            volumeMm3: true,
            updatedAt: true,
          },
        },
      },
      take: 24,
    }),
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
  ])
  const models = items.map(({ model }) => ({
    ...model,
    priceUsd: resolveModelPrice(model as any, cfg),
  }))
  return NextResponse.json({ models })
}
