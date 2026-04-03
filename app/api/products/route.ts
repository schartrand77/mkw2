import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncStockworksModelsToProductTemplates } from '@/lib/stockworks-products'
import { filterLinkedVariantTemplates } from '@/lib/product-template-variants'

export const dynamic = 'force-dynamic'

export async function GET() {
  try { await syncStockworksModelsToProductTemplates() } catch {}
  const allProducts = await prisma.productTemplate.findMany({
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
  const products = filterLinkedVariantTemplates(allProducts)
  return NextResponse.json({ products })
}
