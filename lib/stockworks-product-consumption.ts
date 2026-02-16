import { prisma } from '@/lib/db'
import { stockworksJson } from '@/lib/stockworks-client'

type CheckoutItemLike = {
  productTemplateId?: string | null
  qty?: number | null
}

type StockMovement = {
  id: number
  movement_type?: string | null
  change_grams?: number | null
  reference?: string | null
}

const normalizeReference = (value?: string | null) => (value || '').trim()

async function movementAlreadyRecorded(inventoryItemId: number, reference: string) {
  const movements = await stockworksJson(`/inventory/${inventoryItemId}/movements`) as StockMovement[]
  return movements.some((move) => {
    if (!move || normalizeReference(move.reference) !== reference) return false
    if ((move.movement_type || '').toLowerCase() !== 'outgoing') return false
    return Number(move.change_grams) < 0
  })
}

export async function consumeProductTemplateInventoryOnCheckout(
  paymentIntentId: string,
  items: CheckoutItemLike[],
) {
  const ref = normalizeReference(paymentIntentId)
  if (!ref) return { ok: false, reason: 'missing_reference', movements: 0 }

  const templateQty = new Map<string, number>()
  for (const item of items || []) {
    const templateId = (item?.productTemplateId || '').trim()
    if (!templateId) continue
    const qty = Math.max(1, Math.round(Number(item?.qty || 1)))
    templateQty.set(templateId, (templateQty.get(templateId) || 0) + qty)
  }
  if (templateQty.size === 0) return { ok: false, reason: 'no_product_templates', movements: 0 }

  const templates = await prisma.productTemplate.findMany({
    where: { id: { in: Array.from(templateQty.keys()) } },
    select: { id: true, title: true, stockworksInventoryItemId: true },
  })
  const byId = new Map(templates.map((entry) => [entry.id, entry]))

  let movements = 0
  for (const [templateId, qty] of templateQty.entries()) {
    const template = byId.get(templateId)
    if (!template?.stockworksInventoryItemId) continue
    const inventoryItemId = template.stockworksInventoryItemId
    const movementRef = `${ref}:product:${templateId}`
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
        note: `Product checkout consumption (${template.title || template.id})`,
      }),
    })
    movements += 1
  }

  return { ok: true, movements }
}
