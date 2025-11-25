import type { SiteConfig } from '@prisma/client'
import { getCurrency } from './currency'
import { resolvePrinterProfile, type PrinterProfile, DEFAULT_NOZZLE_DIAMETER_MM } from './printerProfiles'

type PricedModel = {
  volumeMm3?: number | null
  material?: string | null
  priceUsd?: number | null
  salePriceUsd?: number | null
}

export const MATERIAL_DENSITY_DEFAULTS: Record<string, number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  RESIN: 1.08,
}

type MaterialKey = keyof typeof MATERIAL_DENSITY_DEFAULTS

type PrinterProfileOverride = {
  nozzleDiameterMm?: number | null
  materialDensities?: Record<string, number>
}

type PrinterProfileOverrideMap = Record<string, PrinterProfileOverride>

const KG_IN_GRAMS = 1000
const DEFAULT_FILL_FACTOR = 0.18 // Typical 15-20% infill for hobby prints

export type PricingInputs = {
  cm3: number
  material?: string | null
  cfg?: Partial<SiteConfig> | null
}

export interface PricingDetails {
  currency: string
  cm3: number
  effectiveCm3: number
  fillFactor: number
  densityGPerCm3: number
  grams: number
  hours: number
  volumetricSpeedCm3PerHour: number
  nozzleDiameterMm: number
  printerProfile: Pick<PrinterProfile, 'key' | 'label'>
  materialKey: MaterialKey
  materialCost: number
  energyCost: number
  extraHourlyCost: number
  minimumApplied: boolean
  price: number
}

export interface ModelPricingSummary {
  priceUsd: number | null
  basePriceUsd: number | null
  salePriceUsd: number | null
  saleActive: boolean
  breakdown: PricingDetails | null
}

function normalizeFillFactor(value?: number | null): number {
  if (value == null || Number.isNaN(value)) return DEFAULT_FILL_FACTOR
  const numeric = Number(value)
  const normalized = numeric > 2 ? numeric / 100 : numeric
  return Math.max(0.1, Math.min(1.5, normalized))
}

function normalizeMaterialKey(material?: string | null): MaterialKey {
  if (!material) return 'PLA'
  const normalized = material.toUpperCase()
  if (normalized in MATERIAL_DENSITY_DEFAULTS) {
    return normalized as MaterialKey
  }
  return 'PLA'
}

function resolvePrinterProfileKey(cfg?: Partial<SiteConfig> | null): string | undefined {
  return cfg?.printerProfileKey
    || process.env.PRINTER_PROFILE
    || process.env.PRINTER_MODEL
    || process.env.PRINTER_TYPE
    || 'BAMBU_X1C'
}

function getPrinterProfileOverride(cfg: Partial<SiteConfig> | null | undefined, profileKey: string): PrinterProfileOverride | null {
  const raw = cfg?.printerProfileOverrides
  if (!raw || typeof raw !== 'object') return null
  const map = raw as PrinterProfileOverrideMap
  const entry = map?.[profileKey]
  if (!entry || typeof entry !== 'object') return null
  return entry
}

function resolveMaterialDensity(material: MaterialKey, cfg: Partial<SiteConfig> | null | undefined, profileKey: string): number {
  const override = getPrinterProfileOverride(cfg, profileKey)
  if (override?.materialDensities) {
    const candidate = override.materialDensities[material] ?? override.materialDensities[material.toLowerCase()]
    if (candidate && Number.isFinite(candidate) && candidate > 0.1) {
      return Number(candidate)
    }
  }
  return MATERIAL_DENSITY_DEFAULTS[material]
}

function resolveNozzleDiameter(profile: PrinterProfile, cfg: Partial<SiteConfig> | null | undefined): number {
  const override = getPrinterProfileOverride(cfg, profile.key)
  const candidate = override?.nozzleDiameterMm
  if (candidate && Number.isFinite(candidate) && candidate > 0.05 && candidate < 2) {
    return Number(candidate)
  }
  return profile.defaultNozzleDiameterMm || DEFAULT_NOZZLE_DIAMETER_MM
}

function resolveVolumetricSpeed(profile: PrinterProfile, cfg: Partial<SiteConfig> | null | undefined, nozzleDiameterMm: number): number {
  const configuredSpeed = cfg?.printSpeedCm3PerHour != null ? Number(cfg.printSpeedCm3PerHour) : NaN
  if (configuredSpeed && !Number.isNaN(configuredSpeed) && configuredSpeed > 0) {
    const treated = configuredSpeed > 0 && configuredSpeed <= 3 ? configuredSpeed * 60 : configuredSpeed
    if (treated > 0) return treated
  }
  const baseNozzle = profile.defaultNozzleDiameterMm || DEFAULT_NOZZLE_DIAMETER_MM
  const nozzleScale = baseNozzle > 0 ? nozzleDiameterMm / baseNozzle : 1
  return profile.volumetricSpeedCm3PerHour * Math.max(0.25, Math.min(2.5, nozzleScale))
}

export function estimatePricingDetails({ cm3, material, cfg }: PricingInputs): PricingDetails {
  const fillFactor = normalizeFillFactor(cfg?.fillFactor != null ? Number(cfg.fillFactor) : undefined)
  const effectiveCm3 = cm3 * fillFactor
  const currency = getCurrency()
  const printerProfile = resolvePrinterProfile(resolvePrinterProfileKey(cfg))
  const nozzleDiameterMm = resolveNozzleDiameter(printerProfile, cfg)
  const volumetricSpeed = resolveVolumetricSpeed(printerProfile, cfg, nozzleDiameterMm)
  const hours = effectiveCm3 / volumetricSpeed

  const materialKey = normalizeMaterialKey(material)
  const density = resolveMaterialDensity(materialKey, cfg, printerProfile.key)
  const grams = effectiveCm3 * density

  const materialCost = grams * (resolveMaterialPricePerKg(materialKey === 'PETG' ? 'PETG' : 'PLA', currency, cfg) / KG_IN_GRAMS)

  const extraHourlyRateEnv = parseFloat(
    currency === 'CAD'
      ? (process.env.EXTRA_HOURLY_AFTER_FIRST_CAD || process.env.EXTRA_HOURLY_AFTER_FIRST_USD || '0')
      : (process.env.EXTRA_HOURLY_AFTER_FIRST_USD || '0')
  )
  const extraHourlyRate = cfg?.extraHourlyUsdAfterFirst != null && Number.isFinite(Number(cfg.extraHourlyUsdAfterFirst))
    ? Number(cfg.extraHourlyUsdAfterFirst)
    : (Number.isFinite(extraHourlyRateEnv) && extraHourlyRateEnv > 0 ? extraHourlyRateEnv : 0)
  const extraHourlyCost = extraHourlyRate * Math.max(0, hours - 1)

  const envEnergyRate = parseFloat(
    currency === 'CAD'
      ? (process.env.ENERGY_CAD_PER_HOUR || process.env.ENERGY_USD_PER_HOUR || '0')
      : (process.env.ENERGY_USD_PER_HOUR || '0')
  )
  const profileEnergy = printerProfile.energyUsdPerHour
  const energyRate = cfg?.energyUsdPerHour != null && !Number.isNaN(Number(cfg.energyUsdPerHour))
    ? Number(cfg.energyUsdPerHour)
    : (Number.isFinite(envEnergyRate) && envEnergyRate > 0 ? envEnergyRate : profileEnergy)
  const energyCost = energyRate * hours

  const base = materialCost + energyCost + extraHourlyCost
  const minPriceEnv = parseFloat(
    currency === 'CAD'
      ? (process.env.MINIMUM_PRICE_CAD || process.env.MINIMUM_PRICE_USD || '0')
      : (process.env.MINIMUM_PRICE_USD || '0')
  )
  const minPriceConfig = cfg?.minimumPriceUsd != null ? Number(cfg.minimumPriceUsd) : NaN
  const minPrice = Number.isFinite(minPriceConfig) ? Math.max(0, minPriceConfig) : Math.max(0, minPriceEnv)
  const price = Number(Math.max(base, minPrice).toFixed(2))

  return {
    currency,
    cm3,
    effectiveCm3,
    fillFactor,
    densityGPerCm3: Number(density.toFixed(3)),
    grams: Number(grams.toFixed(1)),
    hours: Number(hours.toFixed(2)),
    volumetricSpeedCm3PerHour: Number(volumetricSpeed.toFixed(2)),
    nozzleDiameterMm: Number(nozzleDiameterMm.toFixed(2)),
    printerProfile: { key: printerProfile.key, label: printerProfile.label },
    materialKey,
    materialCost: Number(materialCost.toFixed(2)),
    energyCost: Number(energyCost.toFixed(2)),
    extraHourlyCost: Number(extraHourlyCost.toFixed(2)),
    minimumApplied: price > base,
    price,
  }
}

export function estimatePrice(inputs: PricingInputs): number {
  return estimatePricingDetails(inputs).price
}

function resolveMaterialPricePerKg(material: 'PLA' | 'PETG', currency: string, cfg?: Partial<SiteConfig> | null): number {
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

export function resolveModelPricing(model: PricedModel, cfg?: Partial<SiteConfig> | null): ModelPricingSummary {
  const salePrice = model.salePriceUsd != null && Number.isFinite(Number(model.salePriceUsd)) && Number(model.salePriceUsd) >= 0
    ? Number(model.salePriceUsd)
    : null
  const volume = model.volumeMm3 != null && Number.isFinite(Number(model.volumeMm3)) ? Number(model.volumeMm3) : null
  const breakdown = volume != null
    ? estimatePricingDetails({ cm3: volume / 1000, material: model.material || undefined, cfg })
    : null
  const basePrice = breakdown?.price
    ?? (model.priceUsd != null && Number.isFinite(Number(model.priceUsd)) ? Number(model.priceUsd) : null)
  const priceUsd = salePrice ?? basePrice ?? null
  return {
    priceUsd,
    basePriceUsd: basePrice,
    salePriceUsd: salePrice,
    saleActive: !!salePrice && basePrice != null ? salePrice < basePrice : false,
    breakdown,
  }
}

export function resolveModelPrice(model: PricedModel, cfg?: Partial<SiteConfig> | null): number | null {
  return resolveModelPricing(model, cfg).priceUsd
}
