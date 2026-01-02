import { NextResponse } from 'next/server'

type StockworksMaterial = {
  id: number
  filament_type?: string | null
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
}

const normalizeType = (value?: string | null) => {
  const trimmed = (value || '').trim()
  return trimmed ? trimmed.toUpperCase() : null
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

const normalizeColor = (value?: string | null, hexHint?: string | null): StockworksColor | null => {
  const trimmed = (value || '').trim()
  const hexFromName = normalizeHex(trimmed, false)
  const hexFromHint = normalizeHex(hexHint, true)
  const hex = hexFromName || hexFromHint
  if (!trimmed && !hex) return null
  const name = trimmed ? trimmed.replace(HEX_WITH_PREFIX_RE, '').trim() : ''
  const override = (name || trimmed).trim().toLowerCase()
  const overrideHex = override ? COLOR_OVERRIDES.get(override) : null
  return { name: name || trimmed || hex || 'Unknown', hex: overrideHex || hex }
}


const colorKey = (color: StockworksColor | null) => {
  if (!color) return null
  const raw = (color.name || color.hex || '').trim()
  return raw ? raw.toLowerCase() : null
}

async function loginToStockworks(baseUrl: string, username: string, password: string): Promise<string | null> {
  const payload = new URLSearchParams({ username, password })
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString(),
    redirect: 'manual',
    cache: 'no-store',
  })
  const cookie = response.headers.get('set-cookie')
  if (!cookie) return null
  return cookie.split(';')[0]
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const baseUrl = process.env.STOCKWORKS_BASE_URL?.replace(/\/+$/, '') || ''
  const username = process.env.STOCKWORKS_ADMIN_USERNAME || process.env.STOCKWORKS_USERNAME || ''
  const password = process.env.STOCKWORKS_ADMIN_PASSWORD || process.env.STOCKWORKS_PASSWORD || ''

  if (!baseUrl || !username || !password) {
    return NextResponse.json({ enabled: false, materials: {} })
  }

  const sessionCookie = await loginToStockworks(baseUrl, username, password)
  if (!sessionCookie) {
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

  const materials = (await materialsRes.json()) as StockworksMaterial[]
  const inventory = (await inventoryRes.json()) as StockworksInventoryItem[]
  const materialById = new Map<number, StockworksMaterial>()

  for (const material of materials) {
    if (typeof material.id === 'number') {
      materialById.set(material.id, material)
    }
  }

  const orderableByType = new Map<string, Map<string, StockworksColor>>()
  for (const material of materials) {
    const typeKey = normalizeType(material.filament_type)
    const color = normalizeColor(material.color, material.color_hex || material.color_hex_code || material.hex)
    if (!typeKey || !color) continue
    const key = colorKey(color)
    if (!key) continue
    if (!orderableByType.has(typeKey)) orderableByType.set(typeKey, new Map())
    orderableByType.get(typeKey)!.set(key, color)
  }

  const inStockByType = new Map<string, Map<string, StockworksColor>>()
  for (const item of inventory) {
    const qty = typeof item.quantity_grams === 'number' ? item.quantity_grams : 0
    if (qty <= 0) continue
    const material = item.material || (typeof item.material_id === 'number' ? materialById.get(item.material_id) : null)
    if (!material) continue
    const typeKey = normalizeType(material.filament_type)
    const color = normalizeColor(material.color, material.color_hex || material.color_hex_code || material.hex)
    if (!typeKey || !color) continue
    const key = colorKey(color)
    if (!key) continue
    if (!inStockByType.has(typeKey)) inStockByType.set(typeKey, new Map())
    inStockByType.get(typeKey)!.set(key, color)
  }

  const materialsPayload: Record<string, MaterialPalette> = {}
  for (const [typeKey, colors] of orderableByType.entries()) {
    const inStock = Array.from(inStockByType.get(typeKey)?.values() || []).sort((a, b) => {
      const left = a.name || a.hex || ''
      const right = b.name || b.hex || ''
      return left.localeCompare(right)
    })
    const orderable = Array.from(colors.values()).sort((a, b) => {
      const left = a.name || a.hex || ''
      const right = b.name || b.hex || ''
      return left.localeCompare(right)
    })
    materialsPayload[typeKey] = { inStock, orderable }
  }

  return NextResponse.json({ enabled: true, materials: materialsPayload, updatedAt: new Date().toISOString() })
}
