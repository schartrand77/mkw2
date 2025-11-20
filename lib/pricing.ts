import type { SiteConfig } from '@prisma/client'
import { getCurrency } from './currency'
import { getActivePrinterProfile } from './printerProfiles'

type PricedModel = {
  volumeMm3?: number | null
  material?: string | null
  priceUsd?: number | null
  priceOverrideUsd?: number | null
}

const MATERIAL_DENSITY_G_PER_CM3: Record<string, number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  RESIN: 1.08,
}

type MaterialKey = 'PLA' | 'PETG'

const KG_IN_GRAMS = 1000
const ACTIVE_PRINTER_PROFILE = getActivePrinterProfile()
const DEFAULT_FILL_FACTOR = 0.18 // Typical 15–20% infill for hobby prints

export type PricingInputs = {
  cm3: number
  material?: string | null
  cfg?: Partial<SiteConfig> | null
}

function normalizeFillFactor(value?: number | null): number {
  if (value == null || Number.isNaN(value)) return DEFAULT_FILL_FACTOR
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
    speed = ACTIVE_PRINTER_PROFILE.volumetricSpeedCm3PerHour
  } else if (speed > 0 && speed <= 3) {
    // Many admins think in cm^3/minute; small values lead to wildly high price.
    // Treat inputs between 0 and 3 as cm^3/minute and convert to hourly throughput.
    speed = speed * 60
  }
  const hours = effCm3 / speed
  const extraHourlyRateEnv = parseFloat(
    currency === 'CAD'
      ? (process.env.EXTRA_HOURLY_AFTER_FIRST_CAD || process.env.EXTRA_HOURLY_AFTER_FIRST_USD || '0')
      : (process.env.EXTRA_HOURLY_AFTER_FIRST_USD || '0')
  )
  const extraHourlyRate = cfg?.extraHourlyUsdAfterFirst != null && Number.isFinite(Number(cfg.extraHourlyUsdAfterFirst))
    ? Number(cfg.extraHourlyUsdAfterFirst)
    : (Number.isFinite(extraHourlyRateEnv) && extraHourlyRateEnv > 0 ? extraHourlyRateEnv : 0)
  const extraHours = Math.max(0, hours - 1)

  const envEnergyRate = parseFloat(
    currency === 'CAD'
      ? (process.env.ENERGY_CAD_PER_HOUR || process.env.ENERGY_USD_PER_HOUR || '0')
      : (process.env.ENERGY_USD_PER_HOUR || '0')
  )
  const energyRate = cfg?.energyUsdPerHour != null && !Number.isNaN(Number(cfg.energyUsdPerHour))
    ? Number(cfg.energyUsdPerHour)
    : (Number.isFinite(envEnergyRate) && envEnergyRate > 0 ? envEnergyRate : ACTIVE_PRINTER_PROFILE.energyUsdPerHour)
  const energy = energyRate * hours
  const base = materialCost + energy + (extraHourlyRate * extraHours)
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

export function resolveModelPrice(model: PricedModel, cfg?: Partial<SiteConfig> | null): number | null {
  if (model.priceOverrideUsd != null && Number.isFinite(Number(model.priceOverrideUsd))) {
    const override = Number(model.priceOverrideUsd)
    return override >= 0 ? override : null
  }
  if (model.volumeMm3 != null && Number.isFinite(Number(model.volumeMm3))) {
    const cm3 = Number(model.volumeMm3) / 1000
    return estimatePrice({ cm3, material: model.material || undefined, cfg })
  }
  if (model.priceUsd != null && Number.isFinite(Number(model.priceUsd))) {
    return Number(model.priceUsd)
  }
  return null
}
