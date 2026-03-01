import { NextResponse } from 'next/server'
import { getStockworksSession } from '@/lib/stockworks-client'

type StockworksMaterial = {
  id: number
  name?: string | null
  title?: string | null
  filament_type?: string | null
  category?: string | null
  brand?: string | null
  manufacturer?: string | null
  vendor?: string | null
  supplier?: string | null
  color?: string | null
  color_hex?: string | null
  color_hex_code?: string | null
  hex?: string | null
}

type StockworksInventoryItem = {
  id: number
  material_id?: number | null
  quantity_grams?: number | null
  material?: StockworksMaterial | null
}

type MaterialPalette = {
  inStock: StockworksColor[]
  orderable: StockworksColor[]
}

type StockworksColor = {
  name: string
  hex?: string | null
  brand?: string | null
  category?: string | null
}

const normalizeType = (value?: string | null) => {
  const trimmed = (value || '').trim()
  return trimmed ? trimmed.toUpperCase() : null
}

const parseNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseId = (value: unknown) => {
  const parsed = parseNumber(value)
  return parsed != null ? Math.trunc(parsed) : null
}

const MATERIAL_TYPE_TOKENS = ['PETG', 'RESIN', 'NYLON', 'PA12', 'PA6', 'ASA', 'ABS', 'TPU', 'PLA', 'PC'] as const

const inferMaterialType = (material?: StockworksMaterial | null) => {
  if (!material) return null
  const direct = normalizeType(material.filament_type)
  if (direct) {
    for (const token of MATERIAL_TYPE_TOKENS) {
      if (direct === token || direct.includes(token)) return token
    }
    return direct
  }
  const candidates = [material.category, material.name, material.title]
  for (const candidate of candidates) {
    const upper = normalizeType(candidate)
    if (!upper) continue
    for (const token of MATERIAL_TYPE_TOKENS) {
      const pattern = new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`)
      if (pattern.test(upper)) return token
    }
  }
  return null
}

const HEX_WITH_PREFIX_RE = /(?:#|0x)([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})/i
const HEX_ONLY_RE = /^(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})$/i

const normalizeAlphaHex = (value: string) => {
  const trimmed = value.trim()
  if (!/^#([0-9a-f]{8})$/i.test(trimmed)) return trimmed
  const hex = trimmed.slice(1)
  const alpha = hex.slice(0, 2).toLowerCase()
  const tail = hex.slice(6, 8).toLowerCase()
  if ((alpha === '00' || alpha === 'ff') && tail !== '00' && tail !== 'ff') {
    return `#${hex.slice(2)}${alpha}`
  }
  return trimmed
}

const normalizeHex = (value?: string | null, allowBare = false) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return null
  if (allowBare && HEX_ONLY_RE.test(trimmed)) return normalizeAlphaHex(`#${trimmed}`)
  const match = trimmed.match(HEX_WITH_PREFIX_RE)
  return match ? normalizeAlphaHex(`#${match[1]}`) : null
}

const normalizeBrand = (value?: string | null) => {
  const trimmed = (value || '').trim()
  return trimmed || null
}

const normalizeCategory = (value?: string | null) => {
  const trimmed = (value || '').trim()
  return trimmed || null
}

const resolveBrand = (material?: StockworksMaterial | null) => {
  if (!material) return null
  return (
    normalizeBrand(material.brand)
    || normalizeBrand(material.manufacturer)
    || normalizeBrand(material.vendor)
    || normalizeBrand(material.supplier)
  )
}

const resolveCategory = (material?: StockworksMaterial | null) => {
  if (!material) return null
  return normalizeCategory(material.category) || normalizeCategory(material.filament_type)
}

const parseColorOverrides = () => {
  const raw = (process.env.STOCKWORKS_COLOR_OVERRIDES || '').trim()
  if (!raw) return new Map<string, string>()
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    const map = new Map<string, string>()
    for (const [key, value] of Object.entries(parsed)) {
      const normalizedKey = (key || '').trim().toLowerCase()
      const normalizedHex = normalizeHex(value, true)
      if (normalizedKey && normalizedHex) map.set(normalizedKey, normalizedHex)
    }
    return map
  } catch {
    return new Map<string, string>()
  }
}

const COLOR_OVERRIDES = parseColorOverrides()

const normalizeColor = (
  value?: string | null,
  hexHint?: string | null,
  brand?: string | null,
  category?: string | null,
): StockworksColor | null => {
  const trimmed = (value || '').trim()
  const hexFromName = normalizeHex(trimmed, false)
  const hexFromHint = normalizeHex(hexHint, true)
  const hex = hexFromName || hexFromHint
  if (!trimmed && !hex) return null
  const name = trimmed ? trimmed.replace(HEX_WITH_PREFIX_RE, '').trim() : ''
  const override = (name || trimmed).trim().toLowerCase()
  const overrideHex = override ? COLOR_OVERRIDES.get(override) : null
  return {
    name: name || trimmed || hex || 'Unknown',
    hex: overrideHex || hex,
    brand: brand || null,
    category: category || null,
  }
}


const colorKey = (color: StockworksColor | null) => {
  if (!color) return null
  const raw = (color.name || color.hex || '').trim()
  if (!raw) return null
  const brand = (color.brand || '').trim().toLowerCase()
  const category = (color.category || '').trim().toLowerCase()
  const scope = [brand, category].filter(Boolean).join('::')
  return scope ? `${scope}::${raw.toLowerCase()}` : raw.toLowerCase()
}

function coerceArray<T = any>(payload: any, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (!payload || typeof payload !== 'object') return []
  for (const key of keys) {
    if (Array.isArray((payload as Record<string, unknown>)[key])) {
      return (payload as Record<string, unknown>)[key] as T[]
    }
  }
  return []
}

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const baseUrl = process.env.STOCKWORKS_BASE_URL?.replace(/\/+$/, '') || ''
    const username = process.env.STOCKWORKS_ADMIN_USERNAME || process.env.STOCKWORKS_USERNAME || ''
    const password = process.env.STOCKWORKS_ADMIN_PASSWORD || process.env.STOCKWORKS_PASSWORD || ''

    if (!baseUrl || !username || !password) {
      return NextResponse.json({ enabled: false, materials: {} })
    }

    let sessionCookie = ''
    try {
      const session = await getStockworksSession()
      sessionCookie = session.cookie
    } catch {
      return NextResponse.json({ enabled: false, materials: {}, error: 'StockWorks authentication failed.' })
    }

    const headers = { Cookie: sessionCookie }
    const [materialsRes, inventoryRes] = await Promise.all([
      fetch(`${baseUrl}/materials`, { headers, cache: 'no-store' }),
      fetch(`${baseUrl}/inventory`, { headers, cache: 'no-store' }),
    ])

    if (!materialsRes.ok || !inventoryRes.ok) {
      return NextResponse.json({
        enabled: false,
        materials: {},
        error: `StockWorks request failed (${materialsRes.status}/${inventoryRes.status}).`,
      })
    }

    const materialsRaw = await materialsRes.json()
    const inventoryRaw = await inventoryRes.json()
    const materials = coerceArray<StockworksMaterial>(materialsRaw, ['materials', 'items', 'data', 'results'])
    const inventory = coerceArray<StockworksInventoryItem>(inventoryRaw, ['items', 'inventory', 'data', 'results'])
    const materialById = new Map<number, StockworksMaterial>()
    const materialTypes = new Set<string>()

    for (const material of materials) {
      const materialId = parseId(material.id)
      if (materialId != null && materialId > 0) materialById.set(materialId, material)
      const typeKey = inferMaterialType(material)
      if (typeKey) materialTypes.add(typeKey)
    }

    const orderableByType = new Map<string, Map<string, StockworksColor>>()
    for (const material of materials) {
      const typeKey = inferMaterialType(material)
      const color = normalizeColor(
        material.color,
        material.color_hex || material.color_hex_code || material.hex,
        resolveBrand(material),
        resolveCategory(material),
      )
      if (!typeKey || !color) continue
      const key = colorKey(color)
      if (!key) continue
      if (!orderableByType.has(typeKey)) orderableByType.set(typeKey, new Map())
      orderableByType.get(typeKey)!.set(key, color)
    }

    const inStockByType = new Map<string, Map<string, StockworksColor>>()
    for (const item of inventory) {
      const qty = parseNumber(item.quantity_grams) ?? 0
      if (qty <= 0) continue
      const materialId = parseId(item.material_id)
      const material = item.material || (materialId != null ? materialById.get(materialId) : null)
      if (!material) continue
      const typeKey = inferMaterialType(material)
      if (typeKey) materialTypes.add(typeKey)
      const color = normalizeColor(
        material.color,
        material.color_hex || material.color_hex_code || material.hex,
        resolveBrand(material),
        resolveCategory(material),
      )
      if (!typeKey || !color) continue
      const key = colorKey(color)
      if (!key) continue
      if (!inStockByType.has(typeKey)) inStockByType.set(typeKey, new Map())
      inStockByType.get(typeKey)!.set(key, color)
    }

    const materialsPayload: Record<string, MaterialPalette> = {}
    const allTypes = new Set<string>([...orderableByType.keys(), ...inStockByType.keys()])
    for (const typeKey of allTypes) {
      const inStock = Array.from(inStockByType.get(typeKey)?.values() || []).sort((a, b) => {
        const left = a.name || a.hex || ''
        const right = b.name || b.hex || ''
        return left.localeCompare(right)
      })
      const orderable = Array.from(orderableByType.get(typeKey)?.values() || []).sort((a, b) => {
        const left = a.name || a.hex || ''
        const right = b.name || b.hex || ''
        return left.localeCompare(right)
      })
      materialsPayload[typeKey] = { inStock, orderable }
    }

    const typeList = Array.from(new Set([...materialTypes, ...Object.keys(materialsPayload)])).sort((a, b) => a.localeCompare(b))
    return NextResponse.json({
      enabled: true,
      materials: materialsPayload,
      materialTypes: typeList,
      updatedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json({
      enabled: false,
      materials: {},
      error: err?.message || 'StockWorks filament palette failed.',
    })
  }
}
