type PrinterProfileDefinition = {
  label: string
  description: string
  volumetricSpeedCm3PerHour: number
  energyUsdPerHour: number
  defaultNozzleDiameterMm?: number
}

export const DEFAULT_NOZZLE_DIAMETER_MM = 0.4

function mm3PerSecondToCm3PerHour(flowMm3PerSecond: number, utilization = 1) {
  return (flowMm3PerSecond * utilization) / 1000 * 3600
}

function energyCostPerHour(powerWatts: number, electricityUsdPerKwh: number) {
  return (powerWatts / 1000) * electricityUsdPerKwh
}

const DEFAULT_ELECTRICITY_RATE = (() => {
  const envRate = process.env.PRINTER_ELECTRIC_RATE_PER_KWH || process.env.ELECTRIC_RATE_PER_KWH || '0.14'
  const parsed = parseFloat(envRate)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.14
})()

const PROFILE_CONFIG = {
  BAMBU_X1C: {
    label: 'Bambu Lab X1 Carbon',
    description: '32 mm^3/s max flow AMS CoreXY with ~350 W draw',
    volumetricSpeedCm3PerHour: Number(mm3PerSecondToCm3PerHour(32, 0.65).toFixed(2)),
    energyUsdPerHour: Number(energyCostPerHour(350, DEFAULT_ELECTRICITY_RATE).toFixed(4)),
    defaultNozzleDiameterMm: DEFAULT_NOZZLE_DIAMETER_MM,
  },
  BAMBU_P1S: {
    label: 'Bambu Lab P1S/P1P',
    description: '28 mm^3/s CoreXY tuned for AMS lite with ~320 W draw',
    volumetricSpeedCm3PerHour: Number(mm3PerSecondToCm3PerHour(28, 0.65).toFixed(2)),
    energyUsdPerHour: Number(energyCostPerHour(320, DEFAULT_ELECTRICITY_RATE).toFixed(4)),
    defaultNozzleDiameterMm: DEFAULT_NOZZLE_DIAMETER_MM,
  },
  PRUSA_MK4: {
    label: 'Prusa MK4',
    description: '16 mm^3/s input-shaper bedslinger around ~260 W draw',
    volumetricSpeedCm3PerHour: Number(mm3PerSecondToCm3PerHour(16, 0.6).toFixed(2)),
    energyUsdPerHour: Number(energyCostPerHour(260, DEFAULT_ELECTRICITY_RATE).toFixed(4)),
    defaultNozzleDiameterMm: DEFAULT_NOZZLE_DIAMETER_MM,
  },
  PRUSA_MK3S: {
    label: 'Prusa MK3S+',
    description: '11 mm^3/s tried-and-true bedslinger with ~230 W draw',
    volumetricSpeedCm3PerHour: Number(mm3PerSecondToCm3PerHour(11, 0.55).toFixed(2)),
    energyUsdPerHour: Number(energyCostPerHour(230, DEFAULT_ELECTRICITY_RATE).toFixed(4)),
    defaultNozzleDiameterMm: DEFAULT_NOZZLE_DIAMETER_MM,
  },
  CREALITY_K1_MAX: {
    label: 'Creality K1 Max',
    description: '30 mm^3/s enclosed CoreXY with ~420 W draw',
    volumetricSpeedCm3PerHour: Number(mm3PerSecondToCm3PerHour(30, 0.6).toFixed(2)),
    energyUsdPerHour: Number(energyCostPerHour(420, DEFAULT_ELECTRICITY_RATE).toFixed(4)),
    defaultNozzleDiameterMm: DEFAULT_NOZZLE_DIAMETER_MM,
  },
  CREALITY_ENDER3_V2: {
    label: 'Creality Ender 3 V2/Neo',
    description: '9 mm^3/s stock bowden machine around ~220 W draw',
    volumetricSpeedCm3PerHour: Number(mm3PerSecondToCm3PerHour(9, 0.55).toFixed(2)),
    energyUsdPerHour: Number(energyCostPerHour(220, DEFAULT_ELECTRICITY_RATE).toFixed(4)),
    defaultNozzleDiameterMm: DEFAULT_NOZZLE_DIAMETER_MM,
  },
  ANYCUBIC_KOBRA2: {
    label: 'Anycubic Kobra 2',
    description: '20 mm^3/s high-flow bedslinger with ~350 W draw',
    volumetricSpeedCm3PerHour: Number(mm3PerSecondToCm3PerHour(20, 0.6).toFixed(2)),
    energyUsdPerHour: Number(energyCostPerHour(350, DEFAULT_ELECTRICITY_RATE).toFixed(4)),
    defaultNozzleDiameterMm: DEFAULT_NOZZLE_DIAMETER_MM,
  },
  GENERIC_FDM: {
    label: 'Generic 0.4 mm FDM',
    description: '8 mm^3/s bowden printer at ~220 W',
    volumetricSpeedCm3PerHour: Number(mm3PerSecondToCm3PerHour(8, 0.55).toFixed(2)),
    energyUsdPerHour: Number(energyCostPerHour(220, DEFAULT_ELECTRICITY_RATE).toFixed(4)),
    defaultNozzleDiameterMm: DEFAULT_NOZZLE_DIAMETER_MM,
  },
} as const satisfies Record<string, PrinterProfileDefinition>

type PrinterProfileKey = keyof typeof PROFILE_CONFIG

export type PrinterProfile = PrinterProfileDefinition & {
  key: PrinterProfileKey
}

const PROFILES: Record<PrinterProfileKey, PrinterProfile> = Object.keys(PROFILE_CONFIG).reduce(
  (acc, key) => {
    const typedKey = key as PrinterProfileKey
    acc[typedKey] = {
      key: typedKey,
      ...PROFILE_CONFIG[typedKey],
    }
    return acc
  },
  {} as Record<PrinterProfileKey, PrinterProfile>,
)

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
