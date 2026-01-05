import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getMaxCartColors } from '@/lib/cartPricing'

export const dynamic = 'force-dynamic'

const MATERIAL_PRICE_FIELDS = {
  PLA: 'plaPricePerKgUsd',
  PETG: 'petgPricePerKgUsd',
  ABS: 'absPricePerKgUsd',
  ASA: 'asaPricePerKgUsd',
  TPU: 'tpuPricePerKgUsd',
  PA6: 'pa6PricePerKgUsd',
  PA12: 'pa12PricePerKgUsd',
  NYLON: 'nylonPricePerKgUsd',
  PC: 'pcPricePerKgUsd',
  RESIN: 'resinPricePerKgUsd',
} as const

export async function GET() {
  const publicKeyVar = 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env[publicKeyVar] || ''
  const maxCartColors = getMaxCartColors()
  const cfg = await prisma.siteConfig.findUnique({
    where: { id: 'main' },
    select: {
      plaPricePerKgUsd: true,
      petgPricePerKgUsd: true,
      absPricePerKgUsd: true,
      asaPricePerKgUsd: true,
      tpuPricePerKgUsd: true,
      pa6PricePerKgUsd: true,
      pa12PricePerKgUsd: true,
      nylonPricePerKgUsd: true,
      pcPricePerKgUsd: true,
      resinPricePerKgUsd: true,
    },
  })
  const materialPrices: Record<string, number> = {}
  if (cfg) {
    for (const [material, field] of Object.entries(MATERIAL_PRICE_FIELDS)) {
      const value = cfg[field as keyof typeof cfg]
      if (value != null && Number.isFinite(Number(value))) {
        materialPrices[material] = Number(value)
      }
    }
  }
  return NextResponse.json({
    stripePublishableKey,
    maxCartColors,
    materialPrices: Object.keys(materialPrices).length ? materialPrices : null,
  })
}
