import { stockworksFetch, stockworksJson } from '@/lib/stockworks-client'

type StockworksMaterial = {
  id: number
  name?: string | null
  category?: string | null
  filament_type?: string | null
  color?: string | null
  sku?: string | null
  listing_id?: string | null
  unit_price?: number | null
  status?: string | null
  notes?: string | null
  model_category?: string | null
}

type StockworksInventoryItem = {
  id: number
  material_id?: number | null
  location?: string | null
}

export type MerchVariantMapEntry = {
  key: string
  size: string
  color: string
  materialId: number
  inventoryItemId: number | null
}

const MERCH_LOCATION = 'merch'

const normalize = (value?: string | null) => (value || '').trim().toLowerCase()
const normalizeTitle = (value?: string | null) => (value || '').trim()

function normalizeStockworksError(path: string, response: Response, body: any) {
  return Object.assign(new Error((body as any)?.detail || (body as any)?.error || `StockWorks ${path} failed`), {
    status: response.status,
    payload: body,
  })
}

async function postStockworks(path: string, payload: Record<string, unknown>) {
  const response = await stockworksFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw normalizeStockworksError(path, response, body)
  }
  return body
}

async function patchStockworks(path: string, payload: Record<string, unknown>) {
  let response = await stockworksFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let body = await response.json().catch(() => null)
  if (response.ok) return body
  if (response.status === 405) {
    response = await stockworksFetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    body = await response.json().catch(() => null)
    if (response.ok) return body
  }
  if (response.status === 404 || response.status === 405) return null
  throw normalizeStockworksError(path, response, body)
}

function inferApparel(category?: string | null, title?: string | null) {
  const text = `${category || ''} ${title || ''}`.toLowerCase()
  return ['shirt', 'tee', 'hoodie', 'sweatshirt', 'clothing', 'apparel', 'jacket', 'hat', 'cap'].some((token) => text.includes(token))
}

function sanitizeOptions(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const values: string[] = []
  const seen = new Set<string>()
  for (const entry of input) {
    const value = String(entry || '').trim()
    const key = value.toLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    values.push(value.slice(0, 40))
  }
  return values.slice(0, 64)
}

function defaultOptions(input: {
  title: string
  category?: string | null
  sizeOptions?: unknown
  colorOptions?: unknown
}) {
  const apparel = inferApparel(input.category, input.title)
  const requestedSizes = sanitizeOptions(input.sizeOptions)
  const requestedColors = sanitizeOptions(input.colorOptions)
  const fallbackSizes = apparel ? ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] : ['One Size']
  const fallbackColors = apparel ? ['Black', 'White', 'Heather Gray', 'Navy', 'Red'] : ['Black', 'White', 'Gray']
  return {
    sizes: requestedSizes.length > 0 ? requestedSizes : fallbackSizes,
    colors: requestedColors.length > 0 ? requestedColors : fallbackColors,
  }
}

function normalizeKey(size: string, color: string) {
  return `${size}::${color}`.trim().toLowerCase()
}

function buildVariantName(title: string, size: string, color: string) {
  const normalizedTitle = normalizeTitle(title)
  const sizeLabel = normalizeTitle(size)
  const colorLabel = normalizeTitle(color)
  return `${normalizedTitle} - ${sizeLabel} - ${colorLabel}`.slice(0, 120)
}

function buildVariantSku(itemId: string, size: string, color: string) {
  const itemKey = (itemId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'merch'
  const sizeKey = size.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'NA'
  const colorKey = color.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12) || 'NA'
  return `${itemKey}-${sizeKey}-${colorKey}`.slice(0, 80)
}

function normalizeVariantMap(input: unknown): MerchVariantMapEntry[] {
  if (!Array.isArray(input)) return []
  const output: MerchVariantMapEntry[] = []
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue
    const key = normalizeTitle((entry as any).key)
    const size = normalizeTitle((entry as any).size)
    const color = normalizeTitle((entry as any).color)
    const materialId = Number((entry as any).materialId)
    const inventoryItemIdRaw = (entry as any).inventoryItemId
    const inventoryItemId = inventoryItemIdRaw == null ? NaN : Number(inventoryItemIdRaw)
    if (!key || !size || !color || !Number.isFinite(materialId) || materialId <= 0) continue
    output.push({
      key,
      size,
      color,
      materialId,
      inventoryItemId: Number.isFinite(inventoryItemId) && inventoryItemId > 0 ? inventoryItemId : null,
    })
  }
  return output
}

export async function syncMerchItemToStockworks(input: {
  id: string
  title: string
  category?: string | null
  priceUsd?: number | null
  sizeOptions?: unknown
  colorOptions?: unknown
  stockworksCategory?: string | null
  stockworksStatus?: string | null
  stockworksNotes?: string | null
  stockworksVariantMap?: unknown
}) {
  const category = normalizeTitle(input.stockworksCategory || input.category || 'merch') || 'merch'
  const status = normalizeTitle(input.stockworksStatus || 'Active') || 'Active'
  const notes = normalizeTitle(input.stockworksNotes || null) || null
  const title = normalizeTitle(input.title)
  if (!title) throw new Error('Merch title is required for StockWorks sync.')

  const options = defaultOptions(input)
  const variants = options.sizes.flatMap((size) => options.colors.map((color) => ({ size, color, key: normalizeKey(size, color) })))
  const priorMap = normalizeVariantMap(input.stockworksVariantMap)
  const priorByKey = new Map(priorMap.map((entry) => [normalize(entry.key), entry]))

  const materials = await stockworksJson('/materials') as StockworksMaterial[]
  const inventory = await stockworksJson('/inventory') as StockworksInventoryItem[]
  const inventoryByMaterial = new Map<number, StockworksInventoryItem>()
  for (const row of inventory) {
    if (!row || typeof row.id !== 'number' || typeof row.material_id !== 'number') continue
    if (normalize(row.location) !== MERCH_LOCATION) continue
    if (!inventoryByMaterial.has(row.material_id)) inventoryByMaterial.set(row.material_id, row)
  }

  let createdMaterials = 0
  let updatedMaterials = 0
  let createdInventory = 0
  const nextMap: MerchVariantMapEntry[] = []

  for (const variant of variants) {
    const variantName = buildVariantName(title, variant.size, variant.color)
    const variantSku = buildVariantSku(input.id, variant.size, variant.color)
    const existingRef = priorByKey.get(variant.key)
    const existingMaterial = materials.find((entry) => {
      if (!entry || typeof entry.id !== 'number') return false
      if (existingRef?.materialId && entry.id === existingRef.materialId) return true
      return normalize(entry.category) === normalize(category)
        && normalize(entry.name) === normalize(variantName)
    }) || null

    const payloadExtended = {
      name: variantName,
      filament_type: 'MERCH',
      category,
      model_category: normalizeTitle(input.category || null) || 'Merch',
      color: variant.color,
      sku: variantSku,
      listing_id: variantSku,
      unit_price: typeof input.priceUsd === 'number' && Number.isFinite(input.priceUsd)
        ? Math.max(0, Number(input.priceUsd.toFixed(2)))
        : null,
      status,
      notes,
    }
    const payloadLegacy = {
      name: variantName,
      filament_type: 'MERCH',
      category,
      color: variant.color,
    }

    let materialId = existingMaterial?.id || null
    if (!materialId) {
      let created: { id?: number } | null = null
      try {
        created = await postStockworks('/materials', payloadExtended) as { id?: number }
      } catch (err: any) {
        if (err?.status !== 400 && err?.status !== 422) throw err
        created = await postStockworks('/materials', payloadLegacy) as { id?: number }
      }
      if (!created?.id || !Number.isFinite(created.id)) {
        throw new Error(`StockWorks did not return material id for merch variant ${variantName}.`)
      }
      materialId = created.id
      createdMaterials += 1
    } else {
      try {
        await patchStockworks(`/materials/${materialId}`, payloadExtended)
      } catch (err: any) {
        if (err?.status !== 400 && err?.status !== 422) throw err
        await patchStockworks(`/materials/${materialId}`, payloadLegacy)
      }
      updatedMaterials += 1
    }

    let inventoryItemId = inventoryByMaterial.get(materialId)?.id || null
    if (!inventoryItemId) {
      const createdInventoryEntry = await postStockworks('/inventory', {
        material_id: materialId,
        location: MERCH_LOCATION,
        quantity_grams: 0,
        reorder_level: 0,
      }) as { id?: number }
      if (!createdInventoryEntry?.id || !Number.isFinite(createdInventoryEntry.id)) {
        throw new Error(`StockWorks did not return inventory id for merch variant ${variantName}.`)
      }
      inventoryItemId = createdInventoryEntry.id
      createdInventory += 1
    }

    nextMap.push({
      key: variant.key,
      size: variant.size,
      color: variant.color,
      materialId,
      inventoryItemId,
    })
  }

  return {
    sizeOptions: options.sizes,
    colorOptions: options.colors,
    stockworksVariantMap: nextMap,
    syncSummary: {
      variants: variants.length,
      createdMaterials,
      updatedMaterials,
      createdInventory,
    },
  }
}
