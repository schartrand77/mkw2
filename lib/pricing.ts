import type { SiteConfig } from '@prisma/client'
import { getCurrency } from './currency'
import { resolvePrinterProfile, type PrinterProfile, DEFAULT_NOZZLE_DIAMETER_MM } from './printerProfiles'

type PricedModel = {
  volumeMm3?: number | null
  material?: string | null
  priceUsd?: number | null
  salePriceUsd?: number | null
  supportRatio?: number | null
}

export const MATERIAL_DENSITY_DEFAULTS: Record<string, number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  ASA: 1.07,
  TPU: 1.21,
  PA6: 1.13,
  PA12: 1.01,
  NYLON: 1.14,
  PC: 1.2,
  RESIN: 1.08,
}

type MaterialKey = keyof typeof MATERIAL_DENSITY_DEFAULTS

const DEFAULT_PLA_PRICE = 25
const DEFAULT_PETG_PRICE = 28

const MATERIAL_PRICE_DEFAULTS: Record<MaterialKey, number> = {
  PLA: DEFAULT_PLA_PRICE,
  PETG: DEFAULT_PETG_PRICE,
  ABS: DEFAULT_PLA_PRICE,
  ASA: DEFAULT_PLA_PRICE,
  TPU: DEFAULT_PLA_PRICE,
  PA6: DEFAULT_PLA_PRICE,
  PA12: DEFAULT_PLA_PRICE,
  NYLON: DEFAULT_PLA_PRICE,
  PC: DEFAULT_PLA_PRICE,
  RESIN: DEFAULT_PLA_PRICE,
}

const MATERIAL_PRICE_CONFIG_KEYS: Record<MaterialKey, keyof SiteConfig> = {
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
}

type PrinterProfileOverride = {
  nozzleDiameterMm?: number | null
  materialDensities?: Record<string, number>
}

type PrinterProfileOverrideMap = Record<string, PrinterProfileOverride>

const KG_IN_GRAMS = 1000
const DEFAULT_FILL_FACTOR = 0.18 // Typical 15-20% infill for hobby prints
const DEFAULT_SUPPORT_MULTIPLIER_MAX = 0.6
const DEFAULT_COLOR_TIME_MULTIPLIER_PER_COLOR = 0.2

export type PricingInputs = {
  cm3: number
  material?: string | null
  infillPct?: number | null
  finish?: string | null
  supportRatio?: number | null
  colorCount?: number | null
  cfg?: Partial<SiteConfig> | null
  applyMinimum?: boolean
}

export interface PricingDetails {
  currency: string
  cm3: number
  effectiveCm3: number
  fillFactor: number
  supportRatio: number | null
  supportMultiplier: number
  colorCount: number | null
  colorTimeMultiplier: number
  densityGPerCm3: number
  grams: number
  hours: number
  volumetricSpeedCm3PerHour: number
  nozzleDiameterMm: number
  printerProfile: Pick<PrinterProfile, 'key' | 'label'>
  materialKey: MaterialKey
  materialCost: number
  machineCost: number
  energyCost: number
  laborCost: number
  extraHourlyCost: number
  finish: string | null
  finishSurcharge: number
  finishMultiplier: number
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
  return Math.max(0.05, Math.min(1.5, normalized))
}

function resolveFillFactor(cfg?: Partial<SiteConfig> | null, infillPct?: number | null): number {
  if (infillPct != null && Number.isFinite(Number(infillPct))) {
    return normalizeFillFactor(Number(infillPct))
  }
  return normalizeFillFactor(cfg?.fillFactor != null ? Number(cfg.fillFactor) : undefined)
}

const DEFAULT_FINISH_SURCHARGES: Record<string, number> = {
  standard: 0,
  matte: 0.05,
  gloss: 0.1,
  polished: 0.15,
  textured: 0.08,
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

function resolveFinishSurcharge(finish?: string | null): number {
  if (!finish) return 0
  const normalized = String(finish).trim().toLowerCase()
  if (!normalized) return 0
  const envMap = parseFinishSurcharges(process.env.FINISH_SURCHARGES || process.env.FINISH_SURCHARGE_MAP || null)
  const configured = envMap?.[normalized]
  if (configured != null && Number.isFinite(configured)) return configured
  return DEFAULT_FINISH_SURCHARGES[normalized] ?? 0
}

function normalizeMaterialKey(material?: string | null): MaterialKey {
  if (!material) return 'PLA'
  const normalized = material.toUpperCase()
  if (normalized in MATERIAL_DENSITY_DEFAULTS) {
    return normalized as MaterialKey
  }
  if (normalized.includes('PA6')) return 'PA6'
  if (normalized.includes('PA12')) return 'PA12'
  if (normalized.includes('NYLON')) return 'NYLON'
  if (normalized.includes('TPU')) return 'TPU'
  if (normalized.includes('ASA')) return 'ASA'
  if (normalized.includes('ABS')) return 'ABS'
  if (normalized.includes('PC')) return 'PC'
  return 'PLA'
}

function resolveSupportMultiplier(supportRatio?: number | null): { ratio: number | null, multiplier: number } {
  if (supportRatio == null || Number.isNaN(Number(supportRatio))) {
    return { ratio: null, multiplier: 1 }
  }
  const ratio = Math.max(0, Math.min(1, Number(supportRatio)))
  const raw = process.env.SUPPORT_VOLUME_MULTIPLIER_MAX
  const parsed = raw != null ? Number(raw) : NaN
  const maxMultiplier = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_SUPPORT_MULTIPLIER_MAX
  return { ratio, multiplier: 1 + ratio * maxMultiplier }
}

function resolveColorTimeMultiplier(colorCount?: number | null): { count: number | null, multiplier: number } {
  if (colorCount == null || Number.isNaN(Number(colorCount))) {
    return { count: null, multiplier: 1 }
  }
  const count = Math.max(0, Math.floor(Number(colorCount)))
  if (count <= 1) return { count, multiplier: 1 }
  const raw = process.env.COLOR_TIME_MULTIPLIER_PER_COLOR
  const parsed = raw != null ? Number(raw) : NaN
  const rate = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_COLOR_TIME_MULTIPLIER_PER_COLOR
  const multiplier = 1 + Math.max(0, count - 1) * rate
  return { count, multiplier: Math.max(1, Math.min(5, multiplier)) }
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

export function estimatePricingDetails({
  cm3,
  material,
  infillPct,
  finish,
  supportRatio,
  colorCount,
  cfg,
  applyMinimum,
}: PricingInputs): PricingDetails {
  const applyMinPrice = applyMinimum !== false
  const fillFactor = resolveFillFactor(cfg, infillPct)
  const support = resolveSupportMultiplier(supportRatio)
  const effectiveCm3 = cm3 * fillFactor * support.multiplier
  const currency = getCurrency()
  const printerProfile = resolvePrinterProfile(resolvePrinterProfileKey(cfg))
  const nozzleDiameterMm = resolveNozzleDiameter(printerProfile, cfg)
  const volumetricSpeed = resolveVolumetricSpeed(printerProfile, cfg, nozzleDiameterMm)
  const colorTime = resolveColorTimeMultiplier(colorCount)
  const hours = (effectiveCm3 / volumetricSpeed) * colorTime.multiplier

  const materialKey = normalizeMaterialKey(material)
  const density = resolveMaterialDensity(materialKey, cfg, printerProfile.key)
  const grams = effectiveCm3 * density

  const materialCost = grams * (resolveMaterialPricePerKg(materialKey, currency, cfg) / KG_IN_GRAMS)

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

  const machineRateEnv = parseFloat(
    currency === 'CAD'
      ? (process.env.MACHINE_CAD_PER_HOUR || process.env.MACHINE_USD_PER_HOUR || '0')
      : (process.env.MACHINE_USD_PER_HOUR || '0')
  )
  const machineRate = cfg?.machineUsdPerHour != null && Number.isFinite(Number(cfg.machineUsdPerHour))
    ? Number(cfg.machineUsdPerHour)
    : (Number.isFinite(machineRateEnv) && machineRateEnv > 0 ? machineRateEnv : 0)
  const machineCost = machineRate * hours

  const laborRateEnv = parseFloat(
    currency === 'CAD'
      ? (process.env.LABOR_CAD_PER_HOUR || process.env.LABOR_USD_PER_HOUR || '0')
      : (process.env.LABOR_USD_PER_HOUR || '0')
  )
  const laborRate = cfg?.laborUsdPerHour != null && Number.isFinite(Number(cfg.laborUsdPerHour))
    ? Number(cfg.laborUsdPerHour)
    : (Number.isFinite(laborRateEnv) && laborRateEnv > 0 ? laborRateEnv : 0)
  const laborCost = laborRate * hours

  const base = materialCost + machineCost + energyCost + laborCost + extraHourlyCost
  const finishSurcharge = resolveFinishSurcharge(finish)
  const finishMultiplier = Math.max(1, 1 + finishSurcharge)
  const finishAdjustedBase = base * finishMultiplier
  const minPriceEnv = parseFloat(
    currency === 'CAD'
      ? (process.env.MINIMUM_PRICE_CAD || process.env.MINIMUM_PRICE_USD || '0')
      : (process.env.MINIMUM_PRICE_USD || '0')
  )
  const minPriceConfig = cfg?.minimumPriceUsd != null ? Number(cfg.minimumPriceUsd) : NaN
  const minPrice = Number.isFinite(minPriceConfig) ? Math.max(0, minPriceConfig) : Math.max(0, minPriceEnv)
  const price = Number(Math.max(finishAdjustedBase, applyMinPrice ? minPrice : 0).toFixed(2))

  return {
    currency,
    cm3,
    effectiveCm3,
    fillFactor,
    supportRatio: support.ratio,
    supportMultiplier: Number(support.multiplier.toFixed(3)),
    colorCount: colorTime.count,
    colorTimeMultiplier: Number(colorTime.multiplier.toFixed(3)),
    densityGPerCm3: Number(density.toFixed(3)),
    grams: Number(grams.toFixed(1)),
    hours: Number(hours.toFixed(2)),
    volumetricSpeedCm3PerHour: Number(volumetricSpeed.toFixed(2)),
    nozzleDiameterMm: Number(nozzleDiameterMm.toFixed(2)),
    printerProfile: { key: printerProfile.key, label: printerProfile.label },
    materialKey,
    materialCost: Number(materialCost.toFixed(2)),
    machineCost: Number(machineCost.toFixed(2)),
    energyCost: Number(energyCost.toFixed(2)),
    laborCost: Number(laborCost.toFixed(2)),
    extraHourlyCost: Number(extraHourlyCost.toFixed(2)),
    finish: finish ? String(finish) : null,
    finishSurcharge: Number(finishSurcharge.toFixed(3)),
    finishMultiplier: Number(finishMultiplier.toFixed(3)),
    minimumApplied: applyMinPrice && price > finishAdjustedBase,
    price,
  }
}

export function estimatePrice(inputs: PricingInputs): number {
  return estimatePricingDetails(inputs).price
}

function resolveMaterialPricePerKg(material: MaterialKey, currency: string, cfg?: Partial<SiteConfig> | null): number {
  const configKey = MATERIAL_PRICE_CONFIG_KEYS[material]
  const configured = cfg?.[configKey]
  if (configured != null && Number.isFinite(Number(configured))) {
    return Number(configured)
  }

  const envUsdKey = `${material}_PRICE_PER_KG_USD`
  const envCadKey = `${material}_PRICE_PER_KG_CAD`
  const envValue = currency === 'CAD'
    ? (process.env[envCadKey] || process.env[envUsdKey])
    : process.env[envUsdKey]
  const envParsed = envValue != null ? Number(envValue) : NaN
  if (Number.isFinite(envParsed) && envParsed >= 0) return envParsed

  return MATERIAL_PRICE_DEFAULTS[material]
}

// Backward-compatible export for existing imports
export const estimatePriceUSD = estimatePrice

export function resolveModelPricing(model: PricedModel, cfg?: Partial<SiteConfig> | null): ModelPricingSummary {
  const salePrice = model.salePriceUsd != null && Number.isFinite(Number(model.salePriceUsd)) && Number(model.salePriceUsd) >= 0
    ? Number(model.salePriceUsd)
    : null
  const volume = model.volumeMm3 != null && Number.isFinite(Number(model.volumeMm3)) ? Number(model.volumeMm3) : null
  const breakdown = volume != null
    ? estimatePricingDetails({
      cm3: volume / 1000,
      material: model.material || undefined,
      supportRatio: model.supportRatio ?? null,
      cfg,
    })
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
