import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const product = await prisma.productTemplate.findFirst({
    where: { id, isActive: true },
    include: {
      baseModel: {
        select: {
          id: true,
          title: true,
          description: true,
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
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ product })
}
