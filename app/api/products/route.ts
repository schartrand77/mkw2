import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncStockworksModelsToProductTemplates } from '@/lib/stockworks-products'

export const dynamic = 'force-dynamic'

export async function GET() {
  try { await syncStockworksModelsToProductTemplates() } catch {}
  const products = await prisma.productTemplate.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
    include: {
      baseModel: {
        select: {
          id: true,
          title: true,
          priceUsd: true,
          effectivePriceUsd: true,
          salePriceUsd: true,
          material: true,
          flatRatePricing: true,
          sizeXmm: true,
          sizeYmm: true,
          sizeZmm: true,
          coverImagePath: true,
          updatedAt: true,
        },
      },
    },
  })
  return NextResponse.json({ products })
}
