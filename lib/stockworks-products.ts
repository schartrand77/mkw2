import { stockworksErrorMessage, stockworksFetch, stockworksJson } from '@/lib/stockworks-client'
import { prisma } from '@/lib/db'
import { buildLockedTemplateOptions } from '@/lib/product-template-config'

type StockworksMaterial = {
  id: number
  name?: string | null
  category?: string | null
  filament_type?: string | null
  color?: string | null
  sku?: string | null
  listing_id?: string | null
  designer?: string | null
  marketplace?: string | null
  file_location?: string | null
  version?: string | null
  unit_price?: number | null
  price_per_gram?: number | null
  spool_weight_grams?: number | null
  status?: string | null
  notes?: string | null
  model_category?: string | null
}

type StockworksInventoryItem = {
  id: number
  material_id?: number | null
  location?: string | null
}

type StockworksPrintModel = {
  id: number
  name?: string | null
  category?: string | null
  sku?: string | null
  designer?: string | null
  platform?: string | null
  file_location?: string | null
  version?: string | null
  unit_price?: number | null
  active?: boolean | null
  notes?: string | null
}

type StockworksListResponse<T> = {
  items?: T[]
  results?: T[]
  data?: T[]
}

export type ProductVariantMapEntry = {
  key: string
  color: string
  materialId: number
  inventoryItemId: number | null
  modelId?: number | null
}

type ProductSyncInput = {
  productTemplateId?: string | null
  title: string
  material?: string | null
  color?: string | null
  colorOptions?: unknown
  category?: string | null
  sku?: string | null
  designer?: string | null
  marketplace?: string | null
  fileLocation?: string | null
  version?: string | null
  unitPriceUsd?: number | null
  status?: string | null
  notes?: string | null
  stockworksMaterialId?: number | null
  stockworksInventoryItemId?: number | null
  stockworksVariantMap?: unknown
}

type StockworksSyncSummary = {
  created: number
  updated: number
  unlinked: number
}

const MODELS_CATEGORY = 'models'
const MODELS_LOCATION = 'models'
const VARIANT_TAG = 'mwv2:template:'

const normalize = (value?: string | null) => (value || '').trim().toLowerCase()
const normalizeTitle = (value?: string | null) => (value || '').trim()
const normalizeMaterialType = (value?: string | null) => (value || 'PLA').trim().toUpperCase() || 'PLA'
const normalizeCategory = (value?: string | null) => normalizeTitle(value) || 'Uncategorized'
const normalizeStatus = (value?: string | null) => normalizeTitle(value) || 'Active'

function normalizeStockworksError(path: string, response: Response, body: any) {
  return Object.assign(new Error(stockworksErrorMessage(body, `StockWorks ${path} failed`)), {
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

function sanitizeColorOptions(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const output: string[] = []
  const seen = new Set<string>()
  for (const entry of input) {
    const row = entry as any
    const value = normalizeTitle(typeof row === 'string' ? row : (row?.value || row?.label || ''))
    if (!value) continue
    const key = normalize(value)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(value)
  }
  return output
}

function normalizeVariantKey(color: string) {
  const key = normalize(color)
  return key || '__default__'
}

function normalizeVariantMap(input: unknown): ProductVariantMapEntry[] {
  if (!Array.isArray(input)) return []
  const output: ProductVariantMapEntry[] = []
  for (const row of input) {
    const entry = row as any
    const key = normalizeTitle(entry?.key)
    const color = normalizeTitle(entry?.color)
    const materialId = Number(entry?.materialId)
    const modelIdRaw = entry?.modelId
    const modelId = modelIdRaw == null ? Number.NaN : Number(modelIdRaw)
    const inventoryItemIdRaw = entry?.inventoryItemId
    const inventoryItemId = inventoryItemIdRaw == null ? Number.NaN : Number(inventoryItemIdRaw)
    if (!key || !color || !Number.isFinite(materialId) || materialId <= 0) continue
    output.push({
      key,
      color,
      materialId,
      inventoryItemId: Number.isFinite(inventoryItemId) && inventoryItemId > 0 ? inventoryItemId : null,
      modelId: Number.isFinite(modelId) && modelId > 0 ? modelId : null,
    })
  }
  return output
}

function buildVariantTitle(baseTitle: string, color: string, useSuffix: boolean) {
  if (!useSuffix || !color) return baseTitle
  return `${baseTitle} - ${color}`.slice(0, 120)
}

function buildVariantSku(baseSku: string | null, color: string, fallbackId: string | null, idx: number) {
  const colorKey = color.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 16) || `C${idx + 1}`
  if (baseSku) return `${baseSku}-${colorKey}`.slice(0, 80)
  if (!fallbackId) return null
  const idKey = fallbackId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'MODEL'
  return `${idKey}-${colorKey}`.slice(0, 80)
}

function buildVariantSystemNote(templateId: string | null, colorKey: string) {
  if (!templateId) return null
  return `${VARIANT_TAG}${templateId}|color:${colorKey}`
}

function mergeNotes(userNotes: string | null, systemNote: string | null) {
  const cleaned = normalizeTitle(userNotes)
  if (!systemNote) return cleaned || null
  if (!cleaned) return systemNote
  const withoutOld = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.toLowerCase().startsWith(VARIANT_TAG))
    .join('\n')
  return [withoutOld, systemNote].filter(Boolean).join('\n').slice(0, 4000)
}

function hasManagedVariantTag(notes?: string | null) {
  return normalizeTitle(notes).toLowerCase().includes(VARIANT_TAG)
}

function toBoolStatus(value?: string | null) {
  const normalized = normalize(value)
  return !['inactive', 'archived', 'disabled', 'draft'].includes(normalized)
}

async function listStockworksModels() {
  const output: StockworksPrintModel[] = []
  let offset = 0
  const limit = 200
  for (let i = 0; i < 50; i += 1) {
    const page = await stockworksJson(`/models?limit=${limit}&offset=${offset}`)
    const items = toList<StockworksPrintModel>(page)
    output.push(...items)
    const total = Number((page as any)?.total)
    if (!Number.isFinite(total) || output.length >= total || items.length < limit) break
    offset += limit
  }
  return output
}

function toList<T>(input: unknown): T[] {
  if (Array.isArray(input)) return input as T[]
  if (input && typeof input === 'object') {
    const row = input as StockworksListResponse<T>
    if (Array.isArray(row.items)) return row.items
    if (Array.isArray(row.results)) return row.results
    if (Array.isArray(row.data)) return row.data
  }
  return []
}

function compactPayload<T extends Record<string, unknown>>(payload: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue
    ;(out as any)[key] = value
  }
  return out
}

export async function syncProductTemplateToStockworks(input: ProductSyncInput) {
  const materials = toList<StockworksMaterial>(await stockworksJson('/materials'))
  const inventory = toList<StockworksInventoryItem>(await stockworksJson('/inventory'))
  const models = await listStockworksModels()

  const requestedTitle = normalizeTitle(input.title)
  const requestedMaterial = normalizeMaterialType(input.material)
  const requestedCategory = normalizeCategory(input.category)
  const requestedStatus = normalizeStatus(input.status)
  const requestedUnitPrice = typeof input.unitPriceUsd === 'number' && Number.isFinite(input.unitPriceUsd)
    ? Math.max(0, Number(input.unitPriceUsd.toFixed(2)))
    : null
  const requestedPricePerGram = requestedUnitPrice ?? 0
  const requestedSpoolWeightGrams = 1
  const requestedSku = normalizeTitle(input.sku) || null
  const requestedDesigner = normalizeTitle(input.designer) || null
  const requestedMarketplace = normalizeTitle(input.marketplace) || null
  const requestedFileLocation = normalizeTitle(input.fileLocation) || null
  const requestedVersion = normalizeTitle(input.version) || null
  const requestedNotes = normalizeTitle(input.notes) || null
  const requestedActive = toBoolStatus(input.status)

  const requestedColors = (() => {
    const fromOptions = sanitizeColorOptions(input.colorOptions)
    const lockedColor = normalizeTitle(input.color)
    const output = [...fromOptions]
    if (lockedColor && !output.some((entry) => normalize(entry) === normalize(lockedColor))) {
      output.unshift(lockedColor)
    }
    if (output.length === 0) output.push(lockedColor || 'Standard')
    return output.slice(0, 64)
  })()

  const priorVariantMap = normalizeVariantMap(input.stockworksVariantMap)
  const priorByKey = new Map(priorVariantMap.map((entry) => [normalize(entry.key), entry]))

  const inventoryByMaterial = new Map<number, number>()
  for (const item of inventory) {
    if (!item || typeof item.id !== 'number' || typeof item.material_id !== 'number') continue
    if (normalize(item.location) !== MODELS_LOCATION) continue
    if (!inventoryByMaterial.has(item.material_id)) inventoryByMaterial.set(item.material_id, item.id)
  }

  const useSuffix = requestedColors.length > 1
  const nextVariantMap: ProductVariantMapEntry[] = []

  for (let idx = 0; idx < requestedColors.length; idx += 1) {
    const color = requestedColors[idx]
    const colorKey = normalizeVariantKey(color)
    const prior = priorByKey.get(colorKey)
    const variantTitle = buildVariantTitle(requestedTitle, color, useSuffix)
    const variantSku = buildVariantSku(requestedSku, color, input.productTemplateId || null, idx)
    const systemNote = buildVariantSystemNote(input.productTemplateId || null, colorKey)
    const mergedNotes = mergeNotes(requestedNotes, systemNote)
    const modelSystemNote = `${systemNote}|kind:model`
    const mergedModelNotes = mergeNotes(requestedNotes, modelSystemNote)

    const existingMaterial = materials.find((entry) => {
      if (!entry || typeof entry.id !== 'number') return false
      if (prior?.materialId && entry.id === prior.materialId) return true
      return normalize(entry.category) === MODELS_CATEGORY
        && normalize(entry.name) === normalize(variantTitle)
        && normalize(entry.color) === normalize(color)
    }) || null
    const existingModel = models.find((entry) => {
      if (!entry || typeof entry.id !== 'number') return false
      if (prior?.modelId && entry.id === prior.modelId) return true
      if (variantSku && normalize(entry.sku) === normalize(variantSku)) return true
      return normalize(entry.name) === normalize(variantTitle) && normalize(entry.notes) === normalize(mergedModelNotes)
    }) || null

    const extendedMaterialPayload = compactPayload({
      name: variantTitle,
      filament_type: requestedMaterial,
      category: MODELS_CATEGORY,
      model_category: requestedCategory,
      color,
      sku: variantSku,
      listing_id: variantSku,
      designer: requestedDesigner,
      marketplace: requestedMarketplace,
      file_location: requestedFileLocation,
      version: requestedVersion,
      unit_price: requestedUnitPrice,
      price_per_gram: requestedPricePerGram,
      spool_weight_grams: requestedSpoolWeightGrams,
      status: requestedStatus,
      notes: mergedNotes,
    })
    const legacyMaterialPayload = compactPayload({
      name: variantTitle,
      filament_type: requestedMaterial,
      category: MODELS_CATEGORY,
      color,
      notes: mergedNotes,
    })
    const modelCreatePayload = compactPayload({
      name: variantTitle,
      category: requestedCategory,
      sku: variantSku,
      designer: requestedDesigner,
      platform: requestedMarketplace,
      file_location: requestedFileLocation,
      version: requestedVersion,
      unit_price: requestedUnitPrice ?? 0,
      active: requestedActive,
      notes: mergedModelNotes,
    })
    const modelUpdatePayload = compactPayload({
      name: variantTitle,
      category: requestedCategory,
      sku: variantSku,
      designer: requestedDesigner,
      platform: requestedMarketplace,
      file_location: requestedFileLocation,
      version: requestedVersion,
      unit_price: requestedUnitPrice ?? 0,
      active: requestedActive,
      notes: mergedModelNotes,
    })

    let materialId = existingMaterial?.id || null
    if (!materialId) {
      let created: { id?: number } | null = null
      try {
        created = await postStockworks('/materials', extendedMaterialPayload) as { id?: number }
      } catch (err: any) {
        // Some StockWorks builds reject extended fields with non-4xx parser/runtime errors.
        // Fall back to minimal payload before failing.
        if (err?.status === 401 || err?.status === 403) throw err
        created = await postStockworks('/materials', legacyMaterialPayload) as { id?: number }
      }
      if (!created?.id || !Number.isFinite(created.id)) {
        throw new Error(`StockWorks did not return a material id for product color ${color}.`)
      }
      materialId = created.id
    } else if (existingMaterial) {
      const shouldUpdateMaterial =
        normalize(existingMaterial.name) !== normalize(variantTitle)
        || normalize(existingMaterial.filament_type) !== normalize(requestedMaterial)
        || normalize(existingMaterial.category) !== MODELS_CATEGORY
        || normalize(existingMaterial.color) !== normalize(color)
        || normalize(existingMaterial.model_category) !== normalize(requestedCategory)
        || normalize(existingMaterial.sku || existingMaterial.listing_id) !== normalize(variantSku)
        || normalize(existingMaterial.designer) !== normalize(requestedDesigner)
        || normalize(existingMaterial.marketplace) !== normalize(requestedMarketplace)
        || normalize(existingMaterial.file_location) !== normalize(requestedFileLocation)
        || normalize(existingMaterial.version) !== normalize(requestedVersion)
        || (typeof existingMaterial.unit_price === 'number' ? Number(existingMaterial.unit_price.toFixed(2)) : null) !== requestedUnitPrice
        || (typeof existingMaterial.price_per_gram === 'number' ? Number(existingMaterial.price_per_gram.toFixed(2)) : null) !== requestedPricePerGram
        || Number(existingMaterial.spool_weight_grams || 0) !== requestedSpoolWeightGrams
        || normalize(existingMaterial.status) !== normalize(requestedStatus)
        || normalize(existingMaterial.notes) !== normalize(mergedNotes)
      if (shouldUpdateMaterial) {
        try {
          await patchStockworks(`/materials/${materialId}`, extendedMaterialPayload)
        } catch (err: any) {
          if (err?.status === 401 || err?.status === 403) throw err
          await patchStockworks(`/materials/${materialId}`, legacyMaterialPayload)
        }
      }
    }

    let inventoryItemId = inventoryByMaterial.get(materialId) || null
    if (!inventoryItemId) {
      const createdInventory = await postStockworks('/inventory', {
        material_id: materialId,
        location: MODELS_LOCATION,
        quantity_grams: 0,
        reorder_level: 0,
      }) as { id?: number }
      if (!createdInventory?.id || !Number.isFinite(createdInventory.id)) {
        throw new Error(`StockWorks did not return an inventory id for product color ${color}.`)
      }
      inventoryItemId = createdInventory.id
      inventoryByMaterial.set(materialId, inventoryItemId)
    }
    let modelId = existingModel?.id || null
    if (!modelId) {
      const createdModel = await postStockworks('/models', modelCreatePayload) as { id?: number }
      if (!createdModel?.id || !Number.isFinite(createdModel.id)) {
        throw new Error(`StockWorks did not return a model id for product color ${color}.`)
      }
      modelId = createdModel.id
    } else if (existingModel) {
      const shouldUpdateModel =
        normalize(existingModel.name) !== normalize(variantTitle)
        || normalize(existingModel.category) !== normalize(requestedCategory)
        || normalize(existingModel.sku) !== normalize(variantSku)
        || normalize(existingModel.designer) !== normalize(requestedDesigner)
        || normalize(existingModel.platform) !== normalize(requestedMarketplace)
        || normalize(existingModel.file_location) !== normalize(requestedFileLocation)
        || normalize(existingModel.version) !== normalize(requestedVersion)
        || (typeof existingModel.unit_price === 'number' ? Number(existingModel.unit_price.toFixed(2)) : null) !== (requestedUnitPrice ?? 0)
        || Boolean(existingModel.active ?? true) !== requestedActive
        || normalize(existingModel.notes) !== normalize(mergedModelNotes)
      if (shouldUpdateModel) {
        await patchStockworks(`/models/${modelId}`, modelUpdatePayload)
      }
    }

    nextVariantMap.push({
      key: colorKey,
      color,
      materialId,
      inventoryItemId,
      modelId,
    })
  }

  const liveKeys = new Set(nextVariantMap.map((entry) => normalize(entry.key)))
  for (const entry of priorVariantMap) {
    if (liveKeys.has(normalize(entry.key))) continue
    if (entry.inventoryItemId) await deleteStockworks(`/inventory/${entry.inventoryItemId}`)
    if (entry.materialId) await deleteStockworks(`/materials/${entry.materialId}`)
    if (entry.modelId) await deleteStockworks(`/models/${entry.modelId}`)
  }

  const preferredColorKey = normalizeVariantKey(normalizeTitle(input.color) || requestedColors[0])
  const preferredVariant = nextVariantMap.find((entry) => normalize(entry.key) === normalize(preferredColorKey)) || nextVariantMap[0] || null

  return {
    materialId: preferredVariant?.materialId ?? null,
    inventoryItemId: preferredVariant?.inventoryItemId ?? null,
    variantMap: nextVariantMap,
  }
}

export async function unlinkProductTemplateFromStockworks(input: {
  stockworksMaterialId?: number | null
  stockworksInventoryItemId?: number | null
  stockworksVariantMap?: unknown
}) {
  const variants = normalizeVariantMap(input.stockworksVariantMap)
  const inventoryIds = new Set<number>()
  const materialIds = new Set<number>()
  const modelIds = new Set<number>()

  if (input.stockworksInventoryItemId) inventoryIds.add(input.stockworksInventoryItemId)
  if (input.stockworksMaterialId) materialIds.add(input.stockworksMaterialId)

  for (const entry of variants) {
    if (entry.inventoryItemId) inventoryIds.add(entry.inventoryItemId)
    if (entry.materialId) materialIds.add(entry.materialId)
    if (entry.modelId) modelIds.add(entry.modelId)
  }

  for (const inventoryItemId of inventoryIds) {
    await deleteStockworks(`/inventory/${inventoryItemId}`)
  }
  for (const materialId of materialIds) {
    await deleteStockworks(`/materials/${materialId}`)
  }
  for (const modelId of modelIds) {
    await deleteStockworks(`/models/${modelId}`)
  }
}

export async function syncStockworksModelsToProductTemplates(): Promise<StockworksSyncSummary> {
  const materials = toList<StockworksMaterial>(await stockworksJson('/materials'))
  const inventory = toList<StockworksInventoryItem>(await stockworksJson('/inventory'))

  const modelMaterials = materials.filter((entry) =>
    entry
    && typeof entry.id === 'number'
    && normalize(entry.category) === MODELS_CATEGORY
    && Boolean(normalizeTitle(entry.name))
    && !hasManagedVariantTag(entry.notes),
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
          stockworksCategory: normalizeTitle(material.model_category || material.category) || 'Uncategorized',
          stockworksSku: normalizeTitle(material.sku || material.listing_id) || null,
          stockworksDesigner: normalizeTitle(material.designer) || null,
          stockworksMarketplace: normalizeTitle(material.marketplace) || null,
          stockworksFileLocation: normalizeTitle(material.file_location) || null,
          stockworksVersion: normalizeTitle(material.version) || null,
          stockworksUnitPriceUsd: typeof material.unit_price === 'number' && Number.isFinite(material.unit_price) ? material.unit_price : null,
          stockworksStatus: normalizeTitle(material.status) || 'Active',
          stockworksNotes: normalizeTitle(material.notes) || null,
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
    patch.stockworksCategory = normalizeTitle(material.model_category || material.category) || 'Uncategorized'
    patch.stockworksSku = normalizeTitle(material.sku || material.listing_id) || null
    patch.stockworksDesigner = normalizeTitle(material.designer) || null
    patch.stockworksMarketplace = normalizeTitle(material.marketplace) || null
    patch.stockworksFileLocation = normalizeTitle(material.file_location) || null
    patch.stockworksVersion = normalizeTitle(material.version) || null
    patch.stockworksUnitPriceUsd = typeof material.unit_price === 'number' && Number.isFinite(material.unit_price) ? material.unit_price : null
    patch.stockworksStatus = normalizeTitle(material.status) || 'Active'
    patch.stockworksNotes = normalizeTitle(material.notes) || null
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
