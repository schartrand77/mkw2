import { stockworksFetch, stockworksJson } from '@/lib/stockworks-client'
import { prisma } from '@/lib/db'
import { buildLockedTemplateOptions } from '@/lib/product-template-config'

type StockworksMaterial = {
  id: number
  name?: string | null
  category?: string | null
  filament_type?: string | null
  color?: string | null
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

type StockworksSyncSummary = {
  created: number
  updated: number
  unlinked: number
}

const MODELS_CATEGORY = 'models'
const MODELS_LOCATION = 'models'

const normalize = (value?: string | null) => (value || '').trim().toLowerCase()
const normalizeTitle = (value?: string | null) => (value || '').trim()
const normalizeMaterialType = (value?: string | null) => (value || 'PLA').trim().toUpperCase() || 'PLA'

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

async function deleteStockworks(path: string) {
  const response = await stockworksFetch(path, { method: 'DELETE' })
  if (response.ok || response.status === 404 || response.status === 405) return
  const body = await response.json().catch(() => null)
  throw normalizeStockworksError(path, response, body)
}

export async function syncProductTemplateToStockworks(input: ProductSyncInput) {
  const materials = await stockworksJson('/materials') as StockworksMaterial[]
  const inventory = await stockworksJson('/inventory') as StockworksInventoryItem[]

  const requestedTitle = normalizeTitle(input.title)
  const requestedMaterial = normalizeMaterialType(input.material)
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
  } else if (existingMaterial) {
    const shouldUpdateMaterial =
      normalize(existingMaterial.name) !== normalize(requestedTitle)
      || normalize(existingMaterial.filament_type) !== normalize(requestedMaterial)
      || normalize(existingMaterial.category) !== MODELS_CATEGORY
      || normalize(existingMaterial.color) !== normalize(requestedColor)
    if (shouldUpdateMaterial) {
      await patchStockworks(`/materials/${materialId}`, {
        name: requestedTitle,
        filament_type: requestedMaterial,
        category: MODELS_CATEGORY,
        color: requestedColor,
      })
    }
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

export async function unlinkProductTemplateFromStockworks(input: {
  stockworksMaterialId?: number | null
  stockworksInventoryItemId?: number | null
}) {
  if (input.stockworksInventoryItemId) {
    await deleteStockworks(`/inventory/${input.stockworksInventoryItemId}`)
  }
  if (input.stockworksMaterialId) {
    await deleteStockworks(`/materials/${input.stockworksMaterialId}`)
  }
}

export async function syncStockworksModelsToProductTemplates(): Promise<StockworksSyncSummary> {
  const materials = await stockworksJson('/materials') as StockworksMaterial[]
  const inventory = await stockworksJson('/inventory') as StockworksInventoryItem[]

  const modelMaterials = materials.filter((entry) =>
    entry
    && typeof entry.id === 'number'
    && normalize(entry.category) === MODELS_CATEGORY
    && Boolean(normalizeTitle(entry.name)),
  )
  const materialIds = modelMaterials.map((entry) => entry.id)
  const materialNames = modelMaterials
    .map((entry) => normalizeTitle(entry.name))
    .filter((name) => Boolean(name))

  const [existingTemplates, linkedTemplates] = await Promise.all([
    prisma.productTemplate.findMany({
      where: {
        OR: [
          { stockworksMaterialId: { in: materialIds.length ? materialIds : [-1] } },
          { title: { in: materialNames.length ? materialNames : [''] } },
        ],
      },
      select: {
        id: true,
        title: true,
        lockedMaterial: true,
        lockedColor: true,
        stockworksMaterialId: true,
        stockworksInventoryItemId: true,
      },
    }),
    prisma.productTemplate.findMany({
      where: { stockworksMaterialId: { not: null } },
      select: { id: true, stockworksMaterialId: true, stockworksInventoryItemId: true },
    }),
  ])

  const byMaterialId = new Map<number, (typeof existingTemplates)[number]>()
  const byTitle = new Map<string, (typeof existingTemplates)[number]>()
  for (const template of existingTemplates) {
    if (typeof template.stockworksMaterialId === 'number') {
      byMaterialId.set(template.stockworksMaterialId, template)
    }
    const key = normalize(template.title)
    if (key && !byTitle.has(key)) byTitle.set(key, template)
  }

  const inventoryByMaterial = new Map<number, number>()
  for (const item of inventory) {
    if (!item || typeof item.id !== 'number' || typeof item.material_id !== 'number') continue
    if (normalize(item.location) !== MODELS_LOCATION) continue
    if (!inventoryByMaterial.has(item.material_id)) {
      inventoryByMaterial.set(item.material_id, item.id)
    }
  }

  let created = 0
  let updated = 0

  for (const material of modelMaterials) {
    const materialId = material.id
    const title = normalizeTitle(material.name)
    if (!title) continue
    const inventoryItemId = inventoryByMaterial.get(materialId) ?? null
    const existing = byMaterialId.get(materialId) || byTitle.get(normalize(title)) || null
    const locked = buildLockedTemplateOptions({
      material: normalizeMaterialType(material.filament_type),
      color: normalizeTitle(material.color) || null,
      colorCount: 1,
      scale: 1,
      finish: 'standard',
      priceMultiplier: 1,
    })
    if (!existing) {
      await prisma.productTemplate.create({
        data: {
          title,
          lockedMaterial: locked.material,
          lockedColor: locked.color,
          lockedColorCount: locked.colorCount,
          lockedScale: locked.scale,
          lockedFinish: locked.finish,
          lockedPriceMultiplier: locked.priceMultiplier,
          materialOptions: locked.materialOptions,
          colorOptions: locked.colorOptions,
          sizeOptions: locked.sizeOptions,
          stockworksMaterialId: materialId,
          stockworksInventoryItemId: inventoryItemId,
          isActive: false,
        },
      })
      created += 1
      continue
    }

    const patch: Record<string, unknown> = {}
    if (existing.title !== title) patch.title = title
    if (existing.stockworksMaterialId !== materialId) patch.stockworksMaterialId = materialId
    if (existing.stockworksInventoryItemId !== inventoryItemId) patch.stockworksInventoryItemId = inventoryItemId
    if (!normalizeTitle(existing.lockedMaterial)) patch.lockedMaterial = normalizeMaterialType(material.filament_type)
    if (!normalizeTitle(existing.lockedColor)) patch.lockedColor = normalizeTitle(material.color) || null
    patch.lockedColorCount = locked.colorCount
    patch.lockedScale = locked.scale
    patch.lockedFinish = locked.finish
    patch.lockedPriceMultiplier = locked.priceMultiplier
    patch.materialOptions = locked.materialOptions
    patch.colorOptions = locked.colorOptions
    patch.sizeOptions = locked.sizeOptions
    if (Object.keys(patch).length > 0) {
      await prisma.productTemplate.update({
        where: { id: existing.id },
        data: patch,
      })
      updated += 1
    }
  }

  let unlinked = 0
  const liveIds = new Set(materialIds)
  for (const template of linkedTemplates) {
    if (typeof template.stockworksMaterialId !== 'number') continue
    if (liveIds.has(template.stockworksMaterialId)) continue
    await prisma.productTemplate.update({
      where: { id: template.id },
      data: {
        stockworksMaterialId: null,
        stockworksInventoryItemId: null,
      },
    })
    unlinked += 1
  }

  return { created, updated, unlinked }
}
