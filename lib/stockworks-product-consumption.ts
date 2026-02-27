import { prisma } from '@/lib/db'
import { stockworksJson } from '@/lib/stockworks-client'

type CheckoutItemLike = {
  productTemplateId?: string | null
  qty?: number | null
  colors?: (string | null | undefined)[] | null
}

type StockMovement = {
  id: number
  movement_type?: string | null
  change_grams?: number | null
  reference?: string | null
}

type StockworksListResponse<T> = {
  items?: T[]
  results?: T[]
  data?: T[]
}

const normalizeReference = (value?: string | null) => (value || '').trim()
const normalizeColor = (value?: string | null) => (value || '').trim().toLowerCase()

type ProductVariantMapEntry = {
  key?: string
  color?: string
  materialId?: number
  inventoryItemId?: number | null
  modelId?: number | null
}

function normalizeVariantMap(input: unknown): Array<{ key: string; color: string; inventoryItemId: number | null; modelId: number | null }> {
  if (!Array.isArray(input)) return []
  const output: Array<{ key: string; color: string; inventoryItemId: number | null; modelId: number | null }> = []
  for (const row of input as ProductVariantMapEntry[]) {
    const key = String(row?.key || '').trim().toLowerCase()
    const color = String(row?.color || '').trim()
    const inventoryItemId = row?.inventoryItemId == null ? null : Number(row.inventoryItemId)
    const modelId = row?.modelId == null ? null : Number(row.modelId)
    if (!key || !color) continue
    output.push({
      key,
      color,
      inventoryItemId: Number.isFinite(inventoryItemId) && Number(inventoryItemId) > 0 ? Number(inventoryItemId) : null,
      modelId: Number.isFinite(modelId) && Number(modelId) > 0 ? Number(modelId) : null,
    })
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

async function movementAlreadyRecorded(inventoryItemId: number, reference: string) {
  const movements = toList<StockMovement>(await stockworksJson(`/inventory/${inventoryItemId}/movements`))
  return movements.some((move) => {
    if (!move || normalizeReference(move.reference) !== reference) return false
    if ((move.movement_type || '').toLowerCase() !== 'outgoing') return false
    return Number(move.change_grams) < 0
  })
}

async function modelSaleAlreadyRecorded(modelId: number, reference: string) {
  const sales = toList<any>(await stockworksJson(`/models/${modelId}/sales`))
  return sales.some((sale) => normalizeReference(sale?.reference) === reference)
}

export async function consumeProductTemplateInventoryOnCheckout(
  paymentIntentId: string,
  items: CheckoutItemLike[],
) {
  const ref = normalizeReference(paymentIntentId)
  if (!ref) return { ok: false, reason: 'missing_reference', movements: 0 }

  const templateQty = new Map<string, number>()
  const templateColor = new Map<string, string | null>()
  for (const item of items || []) {
    const templateId = (item?.productTemplateId || '').trim()
    if (!templateId) continue
    const qty = Math.max(1, Math.round(Number(item?.qty || 1)))
    templateQty.set(templateId, (templateQty.get(templateId) || 0) + qty)
    const selectedColor = Array.isArray(item?.colors)
      ? String(item.colors.find((entry) => String(entry || '').trim()) || '').trim()
      : ''
    if (selectedColor) templateColor.set(templateId, selectedColor)
  }
  if (templateQty.size === 0) return { ok: false, reason: 'no_product_templates', movements: 0 }

  const templates = await prisma.productTemplate.findMany({
    where: { id: { in: Array.from(templateQty.keys()) } },
    select: { id: true, title: true, stockworksInventoryItemId: true, stockworksUnitPriceUsd: true, stockworksVariantMap: true },
  })
  const byId = new Map(templates.map((entry) => [entry.id, entry]))

  let movements = 0
  for (const [templateId, qty] of templateQty.entries()) {
    const template = byId.get(templateId)
    if (!template) continue
    const selectedColor = templateColor.get(templateId) || null
    const selectedColorKey = selectedColor ? normalizeColor(selectedColor) : ''
    const variantMap = normalizeVariantMap(template.stockworksVariantMap)
    const variant = selectedColorKey
      ? variantMap.find((entry) => normalizeColor(entry.color) === selectedColorKey || entry.key === selectedColorKey)
      : null
    const movementRef = `${ref}:product:${templateId}:${selectedColorKey || 'default'}`
    const modelId = variant?.modelId || null
    if (modelId) {
      const alreadyRecordedSale = await modelSaleAlreadyRecorded(modelId, movementRef)
      if (!alreadyRecordedSale) {
        const unitPrice = Number.isFinite(Number(template.stockworksUnitPriceUsd))
          ? Math.max(0, Number(template.stockworksUnitPriceUsd))
          : 0
        await stockworksJson('/models/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model_id: modelId,
            quantity: Math.max(1, Math.round(qty)),
            unit_price: unitPrice,
            currency: 'USD',
            channel: 'MakerWorks',
            reference: movementRef,
            note: `Product checkout sale (${template.title || template.id}${selectedColor ? ` - ${selectedColor}` : ''})`,
          }),
        })
        movements += 1
      }
      continue
    }
    const inventoryItemId = variant?.inventoryItemId || template.stockworksInventoryItemId
    if (!inventoryItemId) continue
    const alreadyRecorded = await movementAlreadyRecorded(inventoryItemId, movementRef)
    if (alreadyRecorded) continue
    await stockworksJson('/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventory_item_id: inventoryItemId,
        change_grams: -Math.abs(qty),
        movement_type: 'outgoing',
        reference: movementRef,
        note: `Product checkout consumption (${template.title || template.id}${selectedColor ? ` - ${selectedColor}` : ''})`,
      }),
    })
    movements += 1
  }

  return { ok: true, movements }
}
