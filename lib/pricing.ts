import type { SiteConfig } from '@prisma/client'
import { getCurrency } from './currency'

export type PricingInputs = {
  cm3: number
  material?: string | null
  cfg?: Partial<SiteConfig> | null
}

export function estimatePrice({ cm3, material, cfg }: PricingInputs): number {
  const fillFactor = cfg?.fillFactor != null ? Number(cfg.fillFactor) : 1
  const effCm3 = cm3 * Math.max(0.1, Math.min(1.5, fillFactor))
  // Cost per cm3 is currency-agnostic; fall back to a currency-specific env if provided
  const currency = getCurrency()
  const costPerCm3 = (cfg?.costPerCm3 != null
    ? Number(cfg.costPerCm3)
    : parseFloat((currency === 'CAD' ? (process.env.COST_PER_CM3_CAD || process.env.COST_PER_CM3) : process.env.COST_PER_CM3) || '0.3'))
  // The following config fields are stored with *Usd names in DB, but we treat them
  // as values in the selected currency. When no DB cfg is present, read currency-specific env fallbacks.
  const fixedFee = (cfg?.fixedFeeUsd != null
    ? Number(cfg.fixedFeeUsd)
    : parseFloat(
        currency === 'CAD'
          ? (process.env.FIXED_FEE_CAD || process.env.FIXED_FEE_USD || '1.0')
          : (process.env.FIXED_FEE_USD || '1.0')
      ))
  const m = (material || 'PLA').toUpperCase()
  let mult = 1
  if (m === 'ABS') mult = cfg?.materialAbsMultiplier ?? 1
  else if (m === 'PETG') mult = cfg?.materialPetgMultiplier ?? 1
  else if (m === 'RESIN') mult = cfg?.materialResinMultiplier ?? 1.2
  else mult = cfg?.materialPlaMultiplier ?? 1
  const variable = effCm3 * costPerCm3 * (mult || 1)
  const speed = cfg?.printSpeedCm3PerHour && cfg.printSpeedCm3PerHour > 0 ? Number(cfg.printSpeedCm3PerHour) : 15
  const hours = effCm3 / speed
  const laborRate = cfg?.laborPerHourUsd != null
    ? Number(cfg.laborPerHourUsd)
    : parseFloat(
        currency === 'CAD'
          ? (process.env.LABOR_PER_HOUR_CAD || process.env.LABOR_PER_HOUR_USD || '0')
          : (process.env.LABOR_PER_HOUR_USD || '0')
      )
  const energyRate = cfg?.energyUsdPerHour != null
    ? Number(cfg.energyUsdPerHour)
    : parseFloat(
        currency === 'CAD'
          ? (process.env.ENERGY_CAD_PER_HOUR || process.env.ENERGY_USD_PER_HOUR || '0')
          : (process.env.ENERGY_USD_PER_HOUR || '0')
      )
  const labor = laborRate * hours
  const energy = energyRate * hours
  const base = fixedFee + variable + labor + energy
  const minPrice = cfg?.minimumPriceUsd != null
    ? Number(cfg.minimumPriceUsd)
    : parseFloat(
        currency === 'CAD'
          ? (process.env.MINIMUM_PRICE_CAD || process.env.MINIMUM_PRICE_USD || '0')
          : (process.env.MINIMUM_PRICE_USD || '0')
      )
  return Number(Math.max(base, minPrice).toFixed(2))
}

// Backward-compatible export for existing imports
export const estimatePriceUSD = estimatePrice
