import type { SiteConfig } from '@prisma/client'
import { getCurrency } from './currency'

const MATERIAL_DENSITY_G_PER_CM3: Record<string, number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  RESIN: 1.08,
}

type MaterialKey = 'PLA' | 'PETG'

const KG_IN_GRAMS = 1000

export type PricingInputs = {
  cm3: number
  material?: string | null
  cfg?: Partial<SiteConfig> | null
}

function normalizeFillFactor(value?: number | null): number {
  if (value == null || Number.isNaN(value)) return 1
  const numeric = Number(value)
  const normalized = numeric > 2 ? numeric / 100 : numeric
  return Math.max(0.1, Math.min(1.5, normalized))
}

export function estimatePrice({ cm3, material, cfg }: PricingInputs): number {
  const fillFactor = normalizeFillFactor(cfg?.fillFactor != null ? Number(cfg.fillFactor) : undefined)
  const effCm3 = cm3 * fillFactor
  const currency = getCurrency()
  const m = (material || 'PLA').toUpperCase()
  const density = MATERIAL_DENSITY_G_PER_CM3[m] ?? MATERIAL_DENSITY_G_PER_CM3.PLA
  const grams = effCm3 * density
  const materialCost = grams * (resolveMaterialPricePerKg(m === 'PETG' ? 'PETG' : 'PLA', currency, cfg) / KG_IN_GRAMS)

  const configuredSpeed = cfg?.printSpeedCm3PerHour != null ? Number(cfg.printSpeedCm3PerHour) : NaN
  let speed = configuredSpeed
  if (!speed || Number.isNaN(speed) || speed <= 0) {
    speed = 15
  } else if (speed > 0 && speed <= 3) {
    // Many admins think in cm^3/minute; small values lead to wildly high price.
    // Treat inputs between 0 and 3 as cm^3/minute and convert to hourly throughput.
    speed = speed * 60
  }
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
  const base = materialCost + labor + energy
  const minPrice = cfg?.minimumPriceUsd != null
    ? Number(cfg.minimumPriceUsd)
    : parseFloat(
        currency === 'CAD'
          ? (process.env.MINIMUM_PRICE_CAD || process.env.MINIMUM_PRICE_USD || '0')
          : (process.env.MINIMUM_PRICE_USD || '0')
      )
  return Number(Math.max(base, minPrice).toFixed(2))
}

function resolveMaterialPricePerKg(material: MaterialKey, currency: string, cfg?: Partial<SiteConfig> | null): number {
  if (material === 'PETG' && cfg?.petgPricePerKgUsd != null) {
    return Number(cfg.petgPricePerKgUsd)
  }
  if (material === 'PLA' && cfg?.plaPricePerKgUsd != null) {
    return Number(cfg.plaPricePerKgUsd)
  }

  if (material === 'PETG') {
    const envValue = currency === 'CAD'
      ? (process.env.PETG_PRICE_PER_KG_CAD || process.env.PETG_PRICE_PER_KG_USD)
      : process.env.PETG_PRICE_PER_KG_USD
    return parseFloat(envValue || '28')
  }

  const envValue = currency === 'CAD'
    ? (process.env.PLA_PRICE_PER_KG_CAD || process.env.PLA_PRICE_PER_KG_USD)
    : process.env.PLA_PRICE_PER_KG_USD
  return parseFloat(envValue || '25')
}

// Backward-compatible export for existing imports
export const estimatePriceUSD = estimatePrice
