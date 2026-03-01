import { NextRequest, NextResponse } from 'next/server'
import { getStockworksSession, stockworksList } from '@/lib/stockworks-client'

type StockworksMaterial = {
  id: number
  name?: string | null
  title?: string | null
  filament_type?: string | null
  category?: string | null
}

type StockworksInventoryItem = {
  id: number
  material_id?: number | null
  quantity_grams?: number | null
  material?: StockworksMaterial | null
}

const normalizeType = (value?: string | null) => {
  const trimmed = (value || '').trim()
  return trimmed ? trimmed.toUpperCase() : null
}

const parseStockworksNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseStockworksId = (value: unknown) => {
  const parsed = parseStockworksNumber(value)
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

const parseNumber = (value?: string | null, fallback?: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseLeadTimeMap = () => {
  const raw = (process.env.STOCKWORKS_MATERIAL_LEAD_DAYS || '').trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, number>
    const map = new Map<string, number>()
    for (const [key, val] of Object.entries(parsed)) {
      const normalized = normalizeType(key)
      const days = Number(val)
      if (normalized && Number.isFinite(days)) map.set(normalized, days)
    }
    return map
  } catch {
    return null
  }
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const baseUrl = process.env.STOCKWORKS_BASE_URL?.replace(/\/+$/, '') || ''
  const username = process.env.STOCKWORKS_ADMIN_USERNAME || process.env.STOCKWORKS_USERNAME || ''
  const password = process.env.STOCKWORKS_ADMIN_PASSWORD || process.env.STOCKWORKS_PASSWORD || ''
  const limitedThreshold = parseNumber(process.env.STOCKWORKS_LIMITED_THRESHOLD_GRAMS, 1000) ?? 1000
  const defaultLeadDays = parseNumber(process.env.STOCKWORKS_OUT_OF_STOCK_LEAD_DAYS, 7) ?? 7
  const leadTimeMap = parseLeadTimeMap()

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
  let materialsRes: Response
  let inventoryRes: Response
  try {
    ;[materialsRes, inventoryRes] = await Promise.all([
      fetch(`${baseUrl}/materials`, { headers, cache: 'no-store' }),
      fetch(`${baseUrl}/inventory`, { headers, cache: 'no-store' }),
    ])
  } catch {
    return NextResponse.json({
      enabled: false,
      materials: {},
      error: 'StockWorks request failed.',
    })
  }

  if (!materialsRes.ok || !inventoryRes.ok) {
    return NextResponse.json({
      enabled: false,
      materials: {},
      error: `StockWorks request failed (${materialsRes.status}/${inventoryRes.status}).`,
    })
  }

  let materials: StockworksMaterial[] = []
  let inventory: StockworksInventoryItem[] = []
  try {
    const materialsRaw = await materialsRes.json()
    const inventoryRaw = await inventoryRes.json()
    materials = stockworksList<StockworksMaterial>(materialsRaw)
    inventory = stockworksList<StockworksInventoryItem>(inventoryRaw)
  } catch {
    return NextResponse.json({
      enabled: false,
      materials: {},
      error: 'StockWorks returned invalid JSON.',
    })
  }
  const materialById = new Map<number, StockworksMaterial>()
  for (const material of materials) {
    const materialId = parseStockworksId(material.id)
    if (materialId != null && materialId > 0) materialById.set(materialId, material)
  }

  const qtyByType = new Map<string, number>()
  for (const item of inventory) {
    const qty = parseStockworksNumber(item.quantity_grams) ?? 0
    const materialId = parseStockworksId(item.material_id)
    const material = item.material || (materialId != null ? materialById.get(materialId) : null)
    const typeKey = inferMaterialType(material)
    if (!typeKey) continue
    qtyByType.set(typeKey, (qtyByType.get(typeKey) || 0) + qty)
  }

  const { searchParams } = new URL(req.url)
  const filterParam = searchParams.get('materials') || ''
  const filter = filterParam
    .split(',')
    .map((entry) => normalizeType(entry))
    .filter((entry): entry is string => Boolean(entry))
  const materialKeys = filter.length ? filter : Array.from(qtyByType.keys())

  const materialsPayload: Record<string, any> = {}
  for (const key of materialKeys) {
    const qty = qtyByType.get(key) || 0
    const status = qty <= 0
      ? 'out_of_stock'
      : qty <= limitedThreshold
        ? 'limited'
        : 'in_stock'
    const leadTimeDays = status === 'out_of_stock'
      ? (leadTimeMap?.get(key) ?? defaultLeadDays)
      : status === 'limited'
        ? (leadTimeMap?.get(key) ?? null)
        : null
    materialsPayload[key] = {
      status,
      quantityGrams: qty,
      limitedThresholdGrams: limitedThreshold,
      leadTimeDays,
    }
  }

  return NextResponse.json({
    enabled: true,
    materials: materialsPayload,
    updatedAt: new Date().toISOString(),
  })
}
