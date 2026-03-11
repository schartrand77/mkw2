const HEX_COLOR_RE = /^#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})$/i
const HEX_WITH_HASH_RE = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})/i
const HEX_WITH_0X_RE = /0x([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})/i
const HEX_BARE_RE = /\b([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/i
const GRADIENT_SIGNAL_RE = /\b(multigradient|multi[\s-]?gradient|gradient|multi[\s-]?color|multicolor|tri[\s-]?color|dual[\s-]?color|rainbow|sunset|sunrise|aurora|galaxy)\b/i
const NAMED_GRADIENTS: Record<string, string[]> = {
  'dawn radiance': ['#f59e0b', '#fb7185', '#c084fc', '#2dd4bf'],
  'dawn radience': ['#f59e0b', '#fb7185', '#c084fc', '#2dd4bf'],
  'south beach': ['#14b8a6', '#2dd4bf', '#fb7185', '#f472b6'],
  'velvet eclipse': ['#ef4444', '#7f1d1d', '#111827', '#000000'],
}

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

export function extractHexColor(value?: string | null) {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  const hashMatch = trimmed.match(HEX_WITH_HASH_RE)
  if (hashMatch) return normalizeHexColor(`#${hashMatch[1]}`)
  const hexMatch = trimmed.match(HEX_WITH_0X_RE)
  if (hexMatch) return normalizeHexColor(`#${hexMatch[1]}`)
  const bareMatch = trimmed.match(HEX_BARE_RE)
  return bareMatch ? normalizeHexColor(`#${bareMatch[1]}`) : ''
}

export function parseColorDescriptor(value?: string | null) {
  const trimmed = (value || '').trim()
  if (!trimmed) return { name: '', hex: '' }
  const hex = extractHexColor(trimmed)
  const name = trimmed
    .replace(HEX_WITH_HASH_RE, '')
    .replace(HEX_WITH_0X_RE, '')
    .replace(HEX_BARE_RE, '')
    .trim()
  return { name, hex }
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

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100
  const l = lightness / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const segment = hue / 60
  const x = c * (1 - Math.abs((segment % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (segment >= 0 && segment < 1) [r, g, b] = [c, x, 0]
  else if (segment < 2) [r, g, b] = [x, c, 0]
  else if (segment < 3) [r, g, b] = [0, c, x]
  else if (segment < 4) [r, g, b] = [0, x, c]
  else if (segment < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = l - c / 2
  const toHex = (channel: number) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function buildHashedGradient(text: string) {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return []
  const compact = normalized.replace(/[^a-z0-9]+/g, ' ').trim()
  const preset = NAMED_GRADIENTS[normalized]
    || NAMED_GRADIENTS[compact]
    || Object.entries(NAMED_GRADIENTS).find(([key]) => normalized.includes(key) || compact.includes(key))?.[1]
  if (preset?.length) return preset
  const hash = hashString(normalized)
  const baseHue = hash % 360
  const offsets = [0, 48, 128]
  return offsets.map((offset, index) => hslToHex((baseHue + offset) % 360, 78 - index * 6, 60 - index * 4))
}

export function resolveColorStops(input: {
  value?: string | null
  name?: string | null
  hex?: string | null
  category?: string | null
  fallback?: string
}) {
  const parsed = parseColorDescriptor(input.value)
  const fallback = normalizeHexColor(input.fallback || '') || '#1f2937'
  const normalizedHex = normalizeHexColor(input.hex || parsed.hex || '')
  const resolvedName = (input.name || parsed.name || input.value || '').trim()
  const descriptor = `${input.category || ''} ${resolvedName}`.trim()
  const namedPreset = buildHashedGradient(resolvedName)
  const normalizedResolvedName = resolvedName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (
    namedPreset.length >= 2
    && (
      Object.prototype.hasOwnProperty.call(NAMED_GRADIENTS, resolvedName.toLowerCase())
      || Object.prototype.hasOwnProperty.call(NAMED_GRADIENTS, normalizedResolvedName)
      || Object.keys(NAMED_GRADIENTS).some((key) => resolvedName.toLowerCase().includes(key) || normalizedResolvedName.includes(key))
    )
  ) {
    return namedPreset.slice(0, 4)
  }
  const namedHexes = collectNamedHexes(descriptor)
  const gradientHexes = [...namedHexes]

  if (normalizedHex && !gradientHexes.includes(normalizedHex)) {
    gradientHexes.unshift(normalizedHex)
  }

  if (gradientHexes.length >= 2) {
    return gradientHexes.slice(0, 4)
  }

  if (GRADIENT_SIGNAL_RE.test(descriptor)) {
    const anchor = gradientHexes[0] || normalizedHex
    if (anchor) {
      return [tintHex(anchor, 0.35), anchor, shadeHex(anchor, 0.22)].filter(Boolean)
    }
    const hashed = buildHashedGradient(resolvedName || descriptor)
    if (hashed.length >= 2) return hashed
  }

  return [normalizedHex || gradientHexes[0] || fallback].filter(Boolean)
}

export function resolveColorPaint(input: {
  value?: string | null
  name?: string | null
  hex?: string | null
  category?: string | null
  fallback?: string
}) {
  const stops = resolveColorStops(input)
  if (stops.length >= 2) return buildLinearGradient(stops)
  return stops[0] || normalizeHexColor(input.fallback || '') || '#1f2937'
}
