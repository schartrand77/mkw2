type PartLike = {
  id: string
  name?: string | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
}

export type AssemblyGroup = {
  key: string
  label: string
  parts: PartLike[]
  confidence: number
}

const SIDE_TOKENS = ['left', 'right', 'front', 'rear', 'back', 'top', 'bottom', 'upper', 'lower']

function normalizeName(name: string) {
  const cleaned = name
    .toLowerCase()
    .replace(/\.(stl|obj|3mf)$/i, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned
}

function stripSideTokens(name: string) {
  const tokens = name.split(' ')
  const filtered = tokens.filter((t) => !SIDE_TOKENS.includes(t))
  return filtered.join(' ').trim()
}

function baseKey(name: string) {
  const normalized = normalizeName(name)
  const withoutSide = stripSideTokens(normalized)
  const withoutDigits = withoutSide.replace(/\b\d+\b/g, '').trim()
  return withoutDigits || normalized || name
}

function sizeSignature(part: PartLike) {
  const dims = [part.sizeXmm, part.sizeYmm, part.sizeZmm]
    .map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null))
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b)
  if (dims.length === 0) return ''
  return dims.join('x')
}

function computeConfidence(parts: PartLike[], label: string) {
  let score = 0.3
  if (parts.length >= 2) score += 0.2
  if (parts.length >= 4) score += 0.1
  const hasSideTokens = SIDE_TOKENS.some((token) => label.toLowerCase().includes(token))
  if (hasSideTokens) score += 0.1
  const sizeSet = new Set(parts.map(sizeSignature).filter(Boolean))
  if (sizeSet.size <= Math.max(1, Math.ceil(parts.length / 2))) score += 0.2
  return Math.min(1, Number(score.toFixed(2)))
}

export function buildAssemblyGroups(parts: PartLike[]): AssemblyGroup[] {
  if (!parts || parts.length < 2) return []
  const named = parts.filter((part) => typeof part.name === 'string' && part.name.trim())
  if (named.length < 2) return []

  const buckets = new Map<string, PartLike[]>()
  for (const part of named) {
    const key = baseKey(part.name || '')
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(part)
  }

  const groups: AssemblyGroup[] = []
  for (const [key, groupParts] of buckets.entries()) {
    if (groupParts.length < 2) continue
    const label = key.replace(/\b\w/g, (c) => c.toUpperCase())
    groups.push({
      key,
      label,
      parts: groupParts,
      confidence: computeConfidence(groupParts, label),
    })
  }

  groups.sort((a, b) => b.parts.length - a.parts.length || b.confidence - a.confidence || a.label.localeCompare(b.label))
  return groups
}
