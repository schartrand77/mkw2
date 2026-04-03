const DEFAULT_FILAMENT_DIAMETER_MM = 1.75

export type GcodeEstimate = {
  estimatedSeconds: number | null
  filamentMm: number | null
  filamentByToolMm: number[] | null
  filamentGrams: number | null
  filamentByToolGrams: number[] | null
  filamentDiameterMm: number
  volumeMm3: number | null
  cm3: number | null
}

const TIME_RE = /^;TIME:([0-9.]+)\s*$/i
const FILAMENT_USED_RE = /^;FILAMENT USED:\s*([0-9.]+)\s*(MM|M)\s*$/i
const FILAMENT_USED_MM_RE = /^;FILAMENT USED \[MM\]\s*=\s*(.+)$/i
const FILAMENT_USED_G_RE = /^;FILAMENT USED \[G\]\s*=\s*(.+)$/i
const FILAMENT_DIAMETER_RE = /^;FILAMENT DIAMETER\s*=?\s*([0-9.]+)\s*$/i
const ESTIMATED_TIME_RE = /^;ESTIMATED PRINT TIME.*:\s*(.+)$/i

export function estimateFromGcode(text: string): GcodeEstimate {
  const lines = text.split(/\r?\n/)
  let estimatedSeconds: number | null = null
  let filamentMm: number | null = null
  let filamentByToolMm: number[] | null = null
  let filamentGrams: number | null = null
  let filamentByToolGrams: number[] | null = null
  let filamentDiameterMm = DEFAULT_FILAMENT_DIAMETER_MM

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith(';')) continue
    const timeMatch = trimmed.match(TIME_RE)
    if (timeMatch && estimatedSeconds == null) {
      const raw = Number(timeMatch[1])
      if (Number.isFinite(raw) && raw > 0) estimatedSeconds = raw
      continue
    }
    const diameterMatch = trimmed.match(FILAMENT_DIAMETER_RE)
    if (diameterMatch) {
      const raw = Number(diameterMatch[1])
      if (Number.isFinite(raw) && raw > 0.5 && raw < 5) filamentDiameterMm = raw
      continue
    }
    const estTimeMatch = trimmed.match(ESTIMATED_TIME_RE)
    if (estTimeMatch && estimatedSeconds == null) {
      const parsed = parseHumanDuration(estTimeMatch[1])
      if (parsed != null) estimatedSeconds = parsed
      continue
    }
    const usedMatch = trimmed.match(FILAMENT_USED_RE)
    if (usedMatch && filamentMm == null) {
      const raw = Number(usedMatch[1])
      if (Number.isFinite(raw) && raw > 0) {
        filamentMm = usedMatch[2].toUpperCase() === 'M' ? raw * 1000 : raw
      }
      continue
    }
    const usedMmMatch = trimmed.match(FILAMENT_USED_MM_RE)
    if (usedMmMatch && filamentMm == null && filamentByToolMm == null) {
      const parsed = parseNumberList(usedMmMatch[1])
      if (parsed.length === 1) {
        filamentMm = parsed[0]
      } else if (parsed.length > 1) {
        filamentByToolMm = parsed
        filamentMm = parsed.reduce((sum, val) => sum + val, 0)
      }
      continue
    }
    const usedGMatch = trimmed.match(FILAMENT_USED_G_RE)
    if (usedGMatch && filamentGrams == null && filamentByToolGrams == null) {
      const parsed = parseNumberList(usedGMatch[1])
      if (parsed.length === 1) {
        filamentGrams = parsed[0]
      } else if (parsed.length > 1) {
        filamentByToolGrams = parsed
        filamentGrams = parsed.reduce((sum, val) => sum + val, 0)
      }
      continue
    }
  }

  const volumeMm3 = filamentMm != null
    ? filamentMm * Math.PI * Math.pow(filamentDiameterMm / 2, 2)
    : null

  return {
    estimatedSeconds,
    filamentMm,
    filamentByToolMm,
    filamentGrams,
    filamentByToolGrams,
    filamentDiameterMm,
    volumeMm3,
    cm3: volumeMm3 != null ? volumeMm3 / 1000 : null,
  }
}

function parseNumberList(raw: string): number[] {
  return raw
    .split(/[,;]/)
    .map((value) => Number(String(value).trim()))
    .filter((value) => Number.isFinite(value) && value >= 0)
}

function parseHumanDuration(raw: string): number | null {
  const cleaned = raw.toLowerCase()
  const hourMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*h/)
  const minMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*m/)
  const secMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*s/)
  if (!hourMatch && !minMatch && !secMatch) return null
  const hours = hourMatch ? Number(hourMatch[1]) : 0
  const mins = minMatch ? Number(minMatch[1]) : 0
  const secs = secMatch ? Number(secMatch[1]) : 0
  if (![hours, mins, secs].every((val) => Number.isFinite(val))) return null
  return hours * 3600 + mins * 60 + secs
}
