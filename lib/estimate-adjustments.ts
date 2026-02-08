import type { SiteConfig } from '@prisma/client'

export type BatchDiscountTier = {
  minQty: number
  percent: number
}

export type PricingAdjustmentConfig = {
  demandSurgeMultiplier: number
  rushMultiplier: number
  batchDiscountTiers: BatchDiscountTier[]
}

type AdjustmentInput = {
  unitPrice: number
  qty: number
  rush: boolean
  demandSurgeMultiplier: number
  rushMultiplier: number
  batchDiscountPercent: number
}

const DEFAULT_RUSH_MULTIPLIER = 1.25
const DEFAULT_DEMAND_SURGE_MULTIPLIER = 1

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function clampMultiplier(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.max(0.5, Math.min(5, value))
}

export function parseBatchDiscountTiers(raw: unknown): BatchDiscountTier[] {
  if (!raw) return []
  const parsed = typeof raw === 'string' ? safeParseJson(raw) : raw
  if (!Array.isArray(parsed)) return []
  const tiers = parsed
    .map((entry) => {
      const minQty = Number((entry as any)?.minQty)
      const percent = Number((entry as any)?.percent)
      if (!Number.isFinite(minQty) || minQty <= 0) return null
      if (!Number.isFinite(percent) || percent <= 0) return null
      return { minQty: Math.floor(minQty), percent: clampPercent(percent) }
    })
    .filter((tier): tier is BatchDiscountTier => Boolean(tier))
    .sort((a, b) => a.minQty - b.minQty)
  return tiers
}

export function resolveBatchDiscountPercent(qty: number, tiers: BatchDiscountTier[]): number {
  if (!tiers.length || !Number.isFinite(qty)) return 0
  const normalizedQty = Math.max(1, Math.floor(qty))
  let best = 0
  for (const tier of tiers) {
    if (normalizedQty >= tier.minQty) {
      best = Math.max(best, tier.percent)
    }
  }
  return clampPercent(best)
}

export function resolveDemandSurgeMultiplier(cfg?: Partial<SiteConfig> | null): number {
  const configValue = cfg?.demandSurgeMultiplier
  if (configValue != null && Number.isFinite(Number(configValue))) {
    return clampMultiplier(Number(configValue))
  }
  const envValue = Number(process.env.DEMAND_SURGE_MULTIPLIER || process.env.NEXT_PUBLIC_DEMAND_SURGE_MULTIPLIER || DEFAULT_DEMAND_SURGE_MULTIPLIER)
  return clampMultiplier(envValue)
}

export function resolveRushMultiplier(cfg?: Partial<SiteConfig> | null): number {
  const configValue = cfg?.rushMultiplier
  if (configValue != null && Number.isFinite(Number(configValue))) {
    return clampMultiplier(Number(configValue))
  }
  const envValue = Number(process.env.RUSH_MULTIPLIER || process.env.NEXT_PUBLIC_RUSH_MULTIPLIER || DEFAULT_RUSH_MULTIPLIER)
  return clampMultiplier(envValue)
}

export function resolveBatchDiscountTiers(cfg?: Partial<SiteConfig> | null): BatchDiscountTier[] {
  const configValue = cfg?.batchDiscountTiers
  if (configValue) return parseBatchDiscountTiers(configValue)
  return parseBatchDiscountTiers(process.env.BATCH_DISCOUNT_TIERS || process.env.NEXT_PUBLIC_BATCH_DISCOUNT_TIERS || null)
}

export function getPricingAdjustmentConfig(cfg?: Partial<SiteConfig> | null): PricingAdjustmentConfig {
  return {
    demandSurgeMultiplier: resolveDemandSurgeMultiplier(cfg),
    rushMultiplier: resolveRushMultiplier(cfg),
    batchDiscountTiers: resolveBatchDiscountTiers(cfg),
  }
}

export function applyPricingAdjustments(input: AdjustmentInput) {
  const base = Number.isFinite(input.unitPrice) ? input.unitPrice : 0
  const surge = clampMultiplier(input.demandSurgeMultiplier)
  const rush = input.rush ? clampMultiplier(input.rushMultiplier) : 1
  const batchDiscountPercent = clampPercent(input.batchDiscountPercent)
  const batchMultiplier = Math.max(0, 1 - batchDiscountPercent / 100)
  const adjustedUnitPrice = Number((base * surge * rush * batchMultiplier).toFixed(2))
  return {
    adjustedUnitPrice,
    surgeMultiplier: surge,
    rushMultiplier: rush,
    batchDiscountPercent,
  }
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
