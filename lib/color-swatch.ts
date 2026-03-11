const HEX_COLOR_RE = /^#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})$/i
const GRADIENT_SIGNAL_RE = /\b(multigradient|multi[\s-]?gradient|gradient|multi[\s-]?color|multicolor|tri[\s-]?color|dual[\s-]?color|rainbow|sunset|sunrise|aurora|galaxy)\b/i

const COLOR_KEYWORDS: Array<[string, string]> = [
  ['light blue', '#7dd3fc'],
  ['sky blue', '#38bdf8'],
  ['dark blue', '#1d4ed8'],
  ['light green', '#86efac'],
  ['dark green', '#15803d'],
  ['hot pink', '#ec4899'],
  ['light pink', '#f9a8d4'],
  ['dark purple', '#6d28d9'],
  ['light purple', '#c084fc'],
  ['turquoise', '#2dd4bf'],
  ['magenta', '#d946ef'],
  ['fuchsia', '#d946ef'],
  ['violet', '#8b5cf6'],
  ['purple', '#a855f7'],
  ['indigo', '#6366f1'],
  ['navy', '#1e3a8a'],
  ['blue', '#3b82f6'],
  ['cyan', '#22d3ee'],
  ['teal', '#14b8a6'],
  ['mint', '#2dd4bf'],
  ['emerald', '#22c55e'],
  ['green', '#22c55e'],
  ['lime', '#84cc16'],
  ['yellow', '#facc15'],
  ['gold', '#f59e0b'],
  ['orange', '#f97316'],
  ['peach', '#fdba74'],
  ['red', '#ef4444'],
  ['crimson', '#dc2626'],
  ['rose', '#fb7185'],
  ['pink', '#ec4899'],
  ['white', '#f8fafc'],
  ['silver', '#cbd5e1'],
  ['gray', '#94a3b8'],
  ['grey', '#94a3b8'],
  ['black', '#0f172a'],
  ['brown', '#a16207'],
]

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function normalizeHexColor(value?: string | null) {
  const trimmed = (value || '').trim().toLowerCase()
  if (!trimmed.startsWith('#')) return ''
  const hex = trimmed.slice(1)
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
  }
  if (hex.length === 6) return `#${hex}`
  if (hex.length === 8) return `#${hex.slice(2)}`
  return ''
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex)
  if (!normalized || !HEX_COLOR_RE.test(normalized)) return null
  const raw = normalized.slice(1)
  const r = Number.parseInt(raw.slice(0, 2), 16)
  const g = Number.parseInt(raw.slice(2, 4), 16)
  const b = Number.parseInt(raw.slice(4, 6), 16)
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return null
  return { r, g, b }
}

function mixHex(a: string, b: string, ratio: number) {
  const rgbA = hexToRgb(a)
  const rgbB = hexToRgb(b)
  if (!rgbA || !rgbB) return ''
  const blend = (left: number, right: number) => Math.round(left + (right - left) * ratio)
  return `#${[blend(rgbA.r, rgbB.r), blend(rgbA.g, rgbB.g), blend(rgbA.b, rgbB.b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

function tintHex(hex: string, ratio: number) {
  return mixHex(hex, '#ffffff', ratio)
}

function shadeHex(hex: string, ratio: number) {
  return mixHex(hex, '#020617', ratio)
}

function buildLinearGradient(hexes: string[]) {
  if (hexes.length === 0) return ''
  if (hexes.length === 1) return hexes[0]
  const stops = hexes.map((hex, index) => {
    const pct = Math.round((index / (hexes.length - 1)) * 100)
    return `${hex} ${pct}%`
  })
  return `linear-gradient(135deg, ${stops.join(', ')})`
}

function collectNamedHexes(text: string) {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return []
  const output: string[] = []
  for (const [keyword, hex] of COLOR_KEYWORDS) {
    const pattern = new RegExp(`(^|[^a-z])${escapePattern(keyword)}([^a-z]|$)`, 'i')
    if (!pattern.test(normalized)) continue
    const normalizedHex = normalizeHexColor(hex)
    if (normalizedHex && !output.includes(normalizedHex)) output.push(normalizedHex)
  }
  return output
}

export function resolveColorPaint(input: {
  name?: string | null
  hex?: string | null
  category?: string | null
  fallback?: string
}) {
  const fallback = normalizeHexColor(input.fallback || '') || '#1f2937'
  const normalizedHex = normalizeHexColor(input.hex || '')
  const descriptor = `${input.category || ''} ${input.name || ''}`.trim()
  const namedHexes = collectNamedHexes(descriptor)
  const gradientHexes = [...namedHexes]

  if (normalizedHex && !gradientHexes.includes(normalizedHex)) {
    gradientHexes.unshift(normalizedHex)
  }

  if (gradientHexes.length >= 2) {
    return buildLinearGradient(gradientHexes.slice(0, 4))
  }

  if (GRADIENT_SIGNAL_RE.test(descriptor)) {
    const anchor = gradientHexes[0] || normalizedHex
    if (anchor) {
      const lighter = tintHex(anchor, 0.35)
      const darker = shadeHex(anchor, 0.22)
      const fallbackGradient = [lighter, anchor, darker].filter(Boolean)
      return buildLinearGradient(fallbackGradient)
    }
  }

  return normalizedHex || gradientHexes[0] || fallback
}
