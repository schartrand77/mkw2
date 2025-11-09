import type { SiteConfig } from '@prisma/client'

export type PricingInputs = {
  cm3: number
  material?: string | null
  cfg?: Partial<SiteConfig> | null
}

export function estimatePriceUSD({ cm3, material, cfg }: PricingInputs): number {
  const fillFactor = cfg?.fillFactor != null ? Number(cfg.fillFactor) : 1
  const effCm3 = cm3 * Math.max(0.1, Math.min(1.5, fillFactor))
  const costPerCm3 = (cfg?.costPerCm3 != null ? Number(cfg.costPerCm3) : parseFloat(process.env.COST_PER_CM3 || '0.3'))
  const fixedFee = (cfg?.fixedFeeUsd != null ? Number(cfg.fixedFeeUsd) : parseFloat(process.env.FIXED_FEE_USD || '1.0'))
  const m = (material || 'PLA').toUpperCase()
  let mult = 1
  if (m === 'ABS') mult = cfg?.materialAbsMultiplier ?? 1
  else if (m === 'PETG') mult = cfg?.materialPetgMultiplier ?? 1
  else if (m === 'RESIN') mult = cfg?.materialResinMultiplier ?? 1.2
  else mult = cfg?.materialPlaMultiplier ?? 1
  const variable = effCm3 * costPerCm3 * (mult || 1)
  const speed = cfg?.printSpeedCm3PerHour && cfg.printSpeedCm3PerHour > 0 ? Number(cfg.printSpeedCm3PerHour) : 15
  const hours = effCm3 / speed
  const labor = (cfg?.laborPerHourUsd ?? 0) * hours
  const energy = (cfg?.energyUsdPerHour ?? 0) * hours
  const base = fixedFee + variable + labor + energy
  const minPrice = cfg?.minimumPriceUsd ?? 0
  return Number(Math.max(base, minPrice).toFixed(2))
}

