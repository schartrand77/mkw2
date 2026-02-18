const HEX_WITH_HASH_RE = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})/i
const HEX_WITH_0X_RE = /0x([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})/i
const HEX_BARE_RE = /\b([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/i

function normalizeToken(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function extractHex(value?: string | null) {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  const hashMatch = trimmed.match(HEX_WITH_HASH_RE)
  if (hashMatch) return `#${hashMatch[1].toLowerCase()}`
  const hexMatch = trimmed.match(HEX_WITH_0X_RE)
  if (hexMatch) return `#${hexMatch[1].toLowerCase()}`
  const bareMatch = trimmed.match(HEX_BARE_RE)
  return bareMatch ? `#${bareMatch[1].toLowerCase()}` : ''
}

function parseColorName(value?: string | null) {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  return trimmed.replace(HEX_WITH_HASH_RE, '').replace(HEX_WITH_0X_RE, '').replace(HEX_BARE_RE, '').trim()
}

export function getColorTokens(value?: string | null): string[] {
  const raw = normalizeToken(value)
  if (!raw) return []
  const name = normalizeToken(parseColorName(value))
  const hex = normalizeToken(extractHex(value))
  return Array.from(new Set([raw, name, hex].filter(Boolean)))
}

export function normalizeModelColorSlotCount(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(1, Math.min(16, Math.round(parsed)))
}

export function sanitizeAllowedColors(input: unknown): string[] | null {
  if (input == null) return null
  const raw = Array.isArray(input)
    ? input.map((entry) => String(entry ?? ''))
    : String(input).split(',')
  const cleaned = raw.map((entry) => entry.trim()).filter(Boolean)
  if (cleaned.length === 0) return null
  if (cleaned.some((entry) => /^(all|\*)$/i.test(entry))) return null
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of cleaned) {
    const key = normalizeToken(entry)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(entry.slice(0, 80))
    if (out.length >= 128) break
  }
  return out.length ? out : null
}

export function buildAllowedColorTokenSet(allowedColors?: string[] | null): Set<string> | null {
  if (!Array.isArray(allowedColors) || allowedColors.length === 0) return null
  const tokens = new Set<string>()
  for (const color of allowedColors) {
    for (const token of getColorTokens(color)) {
      tokens.add(token)
    }
  }
  return tokens.size > 0 ? tokens : null
}

export function isColorAllowed(value: string | null | undefined, allowedTokens: Set<string> | null): boolean {
  if (!allowedTokens || allowedTokens.size === 0) return true
  const tokens = getColorTokens(value)
  if (tokens.length === 0) return false
  return tokens.some((token) => allowedTokens.has(token))
}
