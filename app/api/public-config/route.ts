import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getMaxCartColors } from '@/lib/cartPricing'
import { getPricingAdjustmentConfig } from '@/lib/estimate-adjustments'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
  const stripePublishableKey = getEnvValue('STRIPE_PUBLISHABLE_KEY')
    || getEnvValue('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    || ''
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
      demandSurgeMultiplier: true,
      rushMultiplier: true,
      batchDiscountTiers: true,
      minimumOrderSubtotalUsd: true,
      minimumOrderNotes: true,
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
  const colorSurchargeRate = readNumber(['NEXT_PUBLIC_COLOR_SURCHARGE_RATE', 'COLOR_SURCHARGE_RATE'], 0.05)
  const finishSurcharges = parseFinishSurcharges(
    process.env.FINISH_SURCHARGES
      || process.env.FINISH_SURCHARGE_MAP
      || process.env.NEXT_PUBLIC_FINISH_SURCHARGES
      || process.env.NEXT_PUBLIC_FINISH_SURCHARGE_MAP
      || null,
  )
  const adjustments = getPricingAdjustmentConfig(cfg || undefined)
  const res = NextResponse.json({
    stripePublishableKey,
    stripeTaxEnabled: isEnabled(getEnvValue('STRIPE_TAX_ENABLED')),
    maxCartColors,
    materialPrices: Object.keys(materialPrices).length ? materialPrices : null,
    colorSurchargeRate,
    finishSurcharges,
    demandSurgeMultiplier: adjustments.demandSurgeMultiplier,
    rushMultiplier: adjustments.rushMultiplier,
    batchDiscountTiers: adjustments.batchDiscountTiers,
    minimumOrderSubtotalUsd: cfg?.minimumOrderSubtotalUsd ?? null,
    minimumOrderNotes: cfg?.minimumOrderNotes ?? null,
  })
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  return res
}

function isEnabled(raw?: string): boolean {
  const value = (raw || '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

function getEnvValue(name: string): string | undefined {
  const entries = Object.entries(process.env)
  for (const [key, value] of entries) {
    if (key === name && typeof value === 'string' && value !== '') return value
  }
  return undefined
}

function readNumber(keys: string[], fallback: number): number {
  for (const key of keys) {
    const raw = process.env[key]
    if (raw != null && raw !== '') {
      const parsed = Number(raw)
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed
    }
  }
  return fallback
}

function parseFinishSurcharges(raw?: string | null): Record<string, number> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const result: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const numeric = Number(value)
      if (!Number.isFinite(numeric)) continue
      result[key.toLowerCase()] = numeric
    }
    return Object.keys(result).length ? result : null
  } catch {
    return null
  }
}
