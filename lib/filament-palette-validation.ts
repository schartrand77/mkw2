import { getColorTokens } from '@/lib/color-constraints'
import { normalizeMaterialName } from '@/lib/cartPricing'

export type FilamentPaletteColor = {
  name?: string | null
  hex?: string | null
}

export type FilamentPaletteMaterial = {
  inStock?: FilamentPaletteColor[]
  orderable?: FilamentPaletteColor[]
}

export type FilamentPaletteResponse = {
  enabled?: boolean
  materials?: Record<string, FilamentPaletteMaterial>
}

function colorTokens(color: FilamentPaletteColor) {
  return [
    ...getColorTokens(color.name),
    ...getColorTokens(color.hex),
    ...getColorTokens(`${color.name || ''} ${color.hex || ''}`),
  ]
}

const HEX_RE = /(?:#|0x)?[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?/ig

function nameTokens(value?: string | null) {
  const name = String(value || '').replace(HEX_RE, '').trim()
  return getColorTokens(name).filter((token) => !token.startsWith('#'))
}

export function buildMaterialColorTokenSet(
  palette: FilamentPaletteResponse | null | undefined,
  material: string | null | undefined,
): Set<string> | null {
  if (!palette?.enabled || !palette.materials) return null
  const materialKey = normalizeMaterialName(material || 'PLA')
  const entry = palette.materials[materialKey]
  if (!entry) return null
  const tokens = new Set<string>()
  for (const color of [...(entry.inStock || []), ...(entry.orderable || [])]) {
    for (const token of colorTokens(color)) tokens.add(token)
  }
  return tokens.size > 0 ? tokens : null
}

function buildMaterialColorNameTokenSet(
  palette: FilamentPaletteResponse | null | undefined,
  material: string | null | undefined,
): Set<string> | null {
  if (!palette?.enabled || !palette.materials) return null
  const materialKey = normalizeMaterialName(material || 'PLA')
  const entry = palette.materials[materialKey]
  if (!entry) return null
  const tokens = new Set<string>()
  for (const color of [...(entry.inStock || []), ...(entry.orderable || [])]) {
    for (const token of nameTokens(color.name)) tokens.add(token)
  }
  return tokens.size > 0 ? tokens : null
}

export function isColorAvailableForMaterial(
  color: string | null | undefined,
  palette: FilamentPaletteResponse | null | undefined,
  material: string | null | undefined,
) {
  const allowed = buildMaterialColorTokenSet(palette, material)
  if (!allowed) return true
  const allowedNames = buildMaterialColorNameTokenSet(palette, material)
  const requestedNames = nameTokens(color)
  if (requestedNames.length > 0 && allowedNames && allowedNames.size > 0) {
    return requestedNames.some((token) => allowedNames.has(token))
  }
  const tokens = getColorTokens(color)
  if (tokens.length === 0) return false
  if (requestedNames.length === 0 && tokens.every((token) => token.startsWith('#'))) {
    return true
  }
  return tokens.some((token) => allowed.has(token))
}
