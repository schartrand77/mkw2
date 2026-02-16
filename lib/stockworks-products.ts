import { stockworksFetch, stockworksJson } from '@/lib/stockworks-client'

type StockworksMaterial = {
  id: number
  name?: string | null
  category?: string | null
}

type StockworksInventoryItem = {
  id: number
  material_id?: number | null
  location?: string | null
}

type ProductSyncInput = {
  title: string
  material?: string | null
  color?: string | null
  stockworksMaterialId?: number | null
  stockworksInventoryItemId?: number | null
}

const MODELS_CATEGORY = 'models'
const MODELS_LOCATION = 'models'

const normalize = (value?: string | null) => (value || '').trim().toLowerCase()

async function postStockworks(path: string, payload: Record<string, unknown>) {
  const response = await stockworksFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw Object.assign(new Error((body as any)?.detail || (body as any)?.error || `StockWorks ${path} failed`), {
      status: response.status,
      payload: body,
    })
  }
  return body
}

export async function syncProductTemplateToStockworks(input: ProductSyncInput) {
  const materials = await stockworksJson('/materials') as StockworksMaterial[]
  const inventory = await stockworksJson('/inventory') as StockworksInventoryItem[]

  const requestedTitle = input.title.trim()
  const requestedMaterial = (input.material || 'PLA').trim().toUpperCase()
  const requestedColor = (input.color || '').trim() || null

  const existingMaterial = materials.find((entry) => {
    if (!entry || typeof entry.id !== 'number') return false
    if (input.stockworksMaterialId && entry.id === input.stockworksMaterialId) return true
    return normalize(entry.category) === MODELS_CATEGORY && normalize(entry.name) === normalize(requestedTitle)
  }) || null

  let materialId = existingMaterial?.id || null
  if (!materialId) {
    const created = await postStockworks('/materials', {
      name: requestedTitle,
      filament_type: requestedMaterial,
      category: MODELS_CATEGORY,
      color: requestedColor,
    }) as { id?: number }
    if (!created?.id || !Number.isFinite(created.id)) {
      throw new Error('StockWorks did not return a material id for the product template.')
    }
    materialId = created.id
  }

  const existingInventory = inventory.find((entry) => {
    if (!entry || typeof entry.id !== 'number') return false
    if (input.stockworksInventoryItemId && entry.id === input.stockworksInventoryItemId) return true
    return entry.material_id === materialId && normalize(entry.location) === MODELS_LOCATION
  }) || null

  let inventoryItemId = existingInventory?.id || null
  if (!inventoryItemId && materialId) {
    const createdInventory = await postStockworks('/inventory', {
      material_id: materialId,
      location: MODELS_LOCATION,
      quantity_grams: 0,
      reorder_level: 0,
    }) as { id?: number }
    if (!createdInventory?.id || !Number.isFinite(createdInventory.id)) {
      throw new Error('StockWorks did not return an inventory id for the product template.')
    }
    inventoryItemId = createdInventory.id
  }

  return { materialId, inventoryItemId }
}
