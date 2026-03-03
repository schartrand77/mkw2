import { getStockworksSession, stockworksList } from '@/lib/stockworks-client'
import { normalizeMaterialName } from '@/lib/cartPricing'

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

export type MaterialAvailabilityStatus = 'in_stock' | 'limited' | 'out_of_stock' | 'unknown'

export type MaterialAvailabilityEntry = {
  status: MaterialAvailabilityStatus
  quantityGrams: number
  limitedThresholdGrams: number
  leadTimeDays?: number | null
}

function normalizeType(value?: string | null) {
  const trimmed = (value || '').trim()
  return trimmed ? trimmed.toUpperCase() : null
}

function parseNumber(value?: string | null, fallback?: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseStockworksNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseStockworksId(value: unknown) {
  const parsed = parseStockworksNumber(value)
  return parsed != null ? Math.trunc(parsed) : null
}

const MATERIAL_TYPE_TOKENS = ['PETG', 'RESIN', 'NYLON', 'PA12', 'PA6', 'ASA', 'ABS', 'TPU', 'PLA', 'PC'] as const

function normalizeMaterialKey(material?: string | null) {
  const key = normalizeMaterialName(material || 'PLA')
  if (key.includes('PA6')) return 'PA6'
  if (key.includes('PA12')) return 'PA12'
  if (key.includes('NYLON')) return 'NYLON'
  if (key.includes('TPU')) return 'TPU'
  if (key.includes('ASA')) return 'ASA'
  if (key.includes('ABS')) return 'ABS'
  if (key.includes('PETG')) return 'PETG'
  if (key.includes('PC')) return 'PC'
  if (key.includes('RESIN')) return 'RESIN'
  return 'PLA'
}

function inferMaterialType(material?: StockworksMaterial | null) {
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

function parseLeadTimeMap() {
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

export async function getMaterialAvailabilitySnapshot(materials?: string[]) {
  const baseUrl = process.env.STOCKWORKS_BASE_URL?.replace(/\/+$/, '') || ''
  const username = process.env.STOCKWORKS_ADMIN_USERNAME || process.env.STOCKWORKS_USERNAME || ''
  const password = process.env.STOCKWORKS_ADMIN_PASSWORD || process.env.STOCKWORKS_PASSWORD || ''
  const limitedThreshold = parseNumber(process.env.STOCKWORKS_LIMITED_THRESHOLD_GRAMS, 1000) ?? 1000
  const defaultLeadDays = parseNumber(process.env.STOCKWORKS_OUT_OF_STOCK_LEAD_DAYS, 7) ?? 7
  const leadTimeMap = parseLeadTimeMap()

  if (!baseUrl || !username || !password) {
    return { enabled: false, materials: {} as Record<string, MaterialAvailabilityEntry> }
  }

  let sessionCookie = ''
  try {
    const session = await getStockworksSession()
    sessionCookie = session.cookie
  } catch {
    return { enabled: false, materials: {} as Record<string, MaterialAvailabilityEntry>, error: 'StockWorks authentication failed.' }
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
    return { enabled: false, materials: {} as Record<string, MaterialAvailabilityEntry>, error: 'StockWorks request failed.' }
  }

  if (!materialsRes.ok || !inventoryRes.ok) {
    return {
      enabled: false,
      materials: {} as Record<string, MaterialAvailabilityEntry>,
      error: `StockWorks request failed (${materialsRes.status}/${inventoryRes.status}).`,
    }
  }

  let stockworksMaterials: StockworksMaterial[] = []
  let inventory: StockworksInventoryItem[] = []
  try {
    stockworksMaterials = stockworksList<StockworksMaterial>(await materialsRes.json())
    inventory = stockworksList<StockworksInventoryItem>(await inventoryRes.json())
  } catch {
    return { enabled: false, materials: {} as Record<string, MaterialAvailabilityEntry>, error: 'StockWorks returned invalid JSON.' }
  }

  const materialById = new Map<number, StockworksMaterial>()
  for (const material of stockworksMaterials) {
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

  const requestedKeys = Array.from(new Set((materials || []).map((entry) => normalizeMaterialKey(entry)).filter(Boolean)))
  const materialKeys = requestedKeys.length > 0 ? requestedKeys : Array.from(qtyByType.keys())
  const payload: Record<string, MaterialAvailabilityEntry> = {}

  for (const key of materialKeys) {
    const qty = qtyByType.get(key) || 0
    const status: MaterialAvailabilityStatus = qty <= 0
      ? 'out_of_stock'
      : qty <= limitedThreshold
        ? 'limited'
        : 'in_stock'
    payload[key] = {
      status,
      quantityGrams: qty,
      limitedThresholdGrams: limitedThreshold,
      leadTimeDays: status === 'in_stock' ? null : (leadTimeMap?.get(key) ?? defaultLeadDays),
    }
  }

  return {
    enabled: true,
    materials: payload,
    updatedAt: new Date().toISOString(),
  }
}

export function normalizeAvailabilityMaterialKey(material?: string | null) {
  return normalizeMaterialKey(material)
}
