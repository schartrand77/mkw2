type PrinterProfileKey = 'BAMBU_X1C' | 'GENERIC_FDM'

export type PrinterProfile = {
  key: PrinterProfileKey
  label: string
  description: string
  volumetricSpeedCm3PerHour: number
  energyUsdPerHour: number
}

function mm3PerSecondToCm3PerHour(flowMm3PerSecond: number, utilization = 1) {
  return flowMm3PerSecond * utilization / 1000 * 3600
}

function energyCostPerHour(powerWatts: number, electricityUsdPerKwh: number) {
  return (powerWatts / 1000) * electricityUsdPerKwh
}

const DEFAULT_ELECTRICITY_RATE = (() => {
  const envRate = process.env.PRINTER_ELECTRIC_RATE_PER_KWH || process.env.ELECTRIC_RATE_PER_KWH || '0.14'
  const parsed = parseFloat(envRate)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.14
})()

const PROFILES: Record<PrinterProfileKey, PrinterProfile> = {
  BAMBU_X1C: {
    key: 'BAMBU_X1C',
    label: 'Bambu Lab X1 Carbon',
    description: '32 mm³/s max flow AMS CoreXY with ~350 W draw',
    volumetricSpeedCm3PerHour: Number(mm3PerSecondToCm3PerHour(32, 0.65).toFixed(2)),
    energyUsdPerHour: Number(energyCostPerHour(350, DEFAULT_ELECTRICITY_RATE).toFixed(4)),
  },
  GENERIC_FDM: {
    key: 'GENERIC_FDM',
    label: 'Generic 0.4 mm FDM',
    description: '8 mm³/s bowden printer at ~220 W',
    volumetricSpeedCm3PerHour: Number(mm3PerSecondToCm3PerHour(8, 0.55).toFixed(2)),
    energyUsdPerHour: Number(energyCostPerHour(220, DEFAULT_ELECTRICITY_RATE).toFixed(4)),
  },
}

function normalizeKey(key?: string | null): PrinterProfileKey | null {
  if (!key) return null
  const normalized = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '')
  return (Object.prototype.hasOwnProperty.call(PROFILES, normalized) ? normalized : null) as PrinterProfileKey | null
}

export function resolvePrinterProfile(key?: string | null): PrinterProfile {
  const normalized = normalizeKey(key)
  if (normalized) {
    return PROFILES[normalized]
  }
  return PROFILES.BAMBU_X1C
}

export function getActivePrinterProfile(): PrinterProfile {
  const envKey = process.env.PRINTER_PROFILE || process.env.PRINTER_MODEL || process.env.PRINTER_TYPE
  return resolvePrinterProfile(envKey)
}

export function getPrinterProfiles(): PrinterProfile[] {
  return Object.values(PROFILES)
}
