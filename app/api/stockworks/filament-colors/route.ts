import { NextResponse } from 'next/server'

type StockworksMaterial = {
  id: number
  filament_type?: string | null
  color?: string | null
}

type StockworksInventoryItem = {
  id: number
  material_id?: number | null
  quantity_grams?: number | null
  material?: StockworksMaterial | null
}

type MaterialPalette = {
  inStock: string[]
  orderable: string[]
}

const normalizeType = (value?: string | null) => {
  const trimmed = (value || '').trim()
  return trimmed ? trimmed.toUpperCase() : null
}

const normalizeColor = (value?: string | null) => {
  const trimmed = (value || '').trim()
  return trimmed ? trimmed : null
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

  const orderableByType = new Map<string, Set<string>>()
  for (const material of materials) {
    const typeKey = normalizeType(material.filament_type)
    const color = normalizeColor(material.color)
    if (!typeKey || !color) continue
    if (!orderableByType.has(typeKey)) orderableByType.set(typeKey, new Set())
    orderableByType.get(typeKey)!.add(color)
  }

  const inStockByType = new Map<string, Set<string>>()
  for (const item of inventory) {
    const qty = typeof item.quantity_grams === 'number' ? item.quantity_grams : 0
    if (qty <= 0) continue
    const material = item.material || (typeof item.material_id === 'number' ? materialById.get(item.material_id) : null)
    if (!material) continue
    const typeKey = normalizeType(material.filament_type)
    const color = normalizeColor(material.color)
    if (!typeKey || !color) continue
    if (!inStockByType.has(typeKey)) inStockByType.set(typeKey, new Set())
    inStockByType.get(typeKey)!.add(color)
  }

  const materialsPayload: Record<string, MaterialPalette> = {}
  for (const [typeKey, colors] of orderableByType.entries()) {
    const inStock = Array.from(inStockByType.get(typeKey) || []).sort((a, b) => a.localeCompare(b))
    const orderable = Array.from(colors).sort((a, b) => a.localeCompare(b))
    materialsPayload[typeKey] = { inStock, orderable }
  }

  return NextResponse.json({ enabled: true, materials: materialsPayload, updatedAt: new Date().toISOString() })
}
