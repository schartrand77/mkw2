import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const products = await prisma.productTemplate.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
    include: {
      baseModel: {
        select: {
          id: true,
          title: true,
          priceUsd: true,
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
