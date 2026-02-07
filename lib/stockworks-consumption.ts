import { prisma } from '@/lib/db'
import { estimatePricingDetails } from '@/lib/pricing'
import { normalizeOrderStatus } from '@/lib/order-status'
import { stockworksJson } from '@/lib/stockworks-client'

const MATERIAL_KEY_ALIASES: Record<string, string> = {
  PLA: 'PLA',
  PETG: 'PETG',
  ABS: 'ABS',
  ASA: 'ASA',
  TPU: 'TPU',
  NYLON: 'NYLON',
  PA6: 'PA6',
  PA12: 'PA12',
  PC: 'PC',
  RESIN: 'RESIN',
}

type InventoryItem = {
  id: number
  quantity_grams: number
  reorder_level: number
  location: string
  material?: {
    id: number
    name: string
    filament_type?: string | null
    color?: string | null
  } | null
}

type ConsumptionLine = {
  inventory_item_id: number
  change_grams: number
  movement_type: 'outgoing'
  reference: string
  note?: string
}

function normalizeMaterialKey(value?: string | null) {
  const raw = (value || '').trim().toUpperCase()
  if (!raw) return 'PLA'
  if (raw in MATERIAL_KEY_ALIASES) return raw
  if (raw.includes('PA6')) return 'PA6'
  if (raw.includes('PA12')) return 'PA12'
  if (raw.includes('NYLON')) return 'NYLON'
  if (raw.includes('TPU')) return 'TPU'
  if (raw.includes('ASA')) return 'ASA'
  if (raw.includes('ABS')) return 'ABS'
  if (raw.includes('PC')) return 'PC'
  return 'PLA'
}

function normalizeColor(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function resolveScale(config: any) {
  if (!config || typeof config !== 'object') return { sx: 1, sy: 1, sz: 1 }
  const sx = Number(config.scaleX ?? config.scale ?? 1)
  const sy = Number(config.scaleY ?? config.scale ?? 1)
  const sz = Number(config.scaleZ ?? config.scale ?? 1)
  return {
    sx: Number.isFinite(sx) && sx > 0 ? sx : 1,
    sy: Number.isFinite(sy) && sy > 0 ? sy : 1,
    sz: Number.isFinite(sz) && sz > 0 ? sz : 1,
  }
}

function buildConsumptionLines(
  inventory: InventoryItem[],
  materialKey: string,
  colors: string[],
  grams: number,
  reference: string,
): ConsumptionLine[] {
  if (!Number.isFinite(grams) || grams <= 0) return []
  const normalizedColors = colors.map(normalizeColor).filter(Boolean)
  const fallback = inventory.find((item) => normalizeMaterialKey(item.material?.filament_type) === materialKey)
  const lines: ConsumptionLine[] = []

  if (normalizedColors.length === 0) {
    if (!fallback) return []
    lines.push({
      inventory_item_id: fallback.id,
      change_grams: -Math.abs(Number(grams.toFixed(1))),
      movement_type: 'outgoing',
      reference,
      note: `Auto consumption for ${materialKey} (no color specified).`,
    })
    return lines
  }

  const perColor = grams / normalizedColors.length
  for (const color of normalizedColors) {
    const match = inventory.find((item) =>
      normalizeMaterialKey(item.material?.filament_type) === materialKey
      && normalizeColor(item.material?.color) === color
    ) || fallback
    if (!match) continue
    lines.push({
      inventory_item_id: match.id,
      change_grams: -Math.abs(Number(perColor.toFixed(1))),
      movement_type: 'outgoing',
      reference,
      note: `Auto consumption for ${materialKey} (${color || 'unknown color'}).`,
    })
  }
  return lines
}

export async function maybeConsumeStockForOrder(orderId: string, trigger: string) {
  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) return { ok: false, reason: 'order_not_found' }

  const normalized = normalizeOrderStatus(order.status)
  if (!['shipped', 'completed'].includes(normalized)) {
    return { ok: false, reason: 'status_not_consumable' }
  }

  const metadata = order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
    ? (order.metadata as Record<string, any>)
    : {}
  if (metadata.stockworksConsumedAt) {
    return { ok: false, reason: 'already_consumed' }
  }

  const [cfg, inventory] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    stockworksJson('/inventory') as Promise<InventoryItem[]>,
  ])

  const reference = order.orderNumber ? `MW-${String(order.orderNumber).padStart(5, '0')}` : order.id
  const consumption: ConsumptionLine[] = []

  const modelIds = Array.from(new Set(order.items.map((i) => i.modelId).filter(Boolean))) as string[]
  const partIds = Array.from(new Set(order.items.map((i) => i.partId).filter(Boolean))) as string[]
  const [models, parts] = await Promise.all([
    modelIds.length ? prisma.model.findMany({ where: { id: { in: modelIds } }, select: { id: true, volumeMm3: true, supportRatio: true } }) : [],
    partIds.length ? prisma.modelPart.findMany({ where: { id: { in: partIds } }, select: { id: true, volumeMm3: true, supportRatio: true, modelId: true } }) : [],
  ])
  const modelMap = new Map(models.map((m) => [m.id, m]))
  const partMap = new Map(parts.map((p) => [p.id, p]))

  for (const item of order.items) {
    const qty = Math.max(1, item.quantity || 1)
    const part = item.partId ? partMap.get(item.partId) : null
    const model = item.modelId ? modelMap.get(item.modelId) : null
    const volumeMm3 = part?.volumeMm3 ?? model?.volumeMm3
    if (!volumeMm3 || !Number.isFinite(Number(volumeMm3))) continue
    const supportRatio = part?.supportRatio ?? model?.supportRatio ?? null
    const { sx, sy, sz } = resolveScale(item.configuration)
    const volumeMultiplier = sx * sy * sz
    const cm3 = (Number(volumeMm3) / 1000) * volumeMultiplier

    const breakdown = estimatePricingDetails({
      cm3,
      material: item.material,
      infillPct: item.infillPct ?? undefined,
      finish: item.finish ?? undefined,
      supportRatio,
      colorCount: Array.isArray(item.colors) ? item.colors.length : null,
      cfg,
      applyMinimum: false,
    })

    const grams = breakdown.grams * qty
    const materialKey = normalizeMaterialKey(item.material)
    const colors = Array.isArray(item.colors)
      ? item.colors.filter((entry): entry is string => typeof entry === 'string')
      : []
    consumption.push(...buildConsumptionLines(inventory, materialKey, colors, grams, reference))
  }

  if (consumption.length === 0) {
    return { ok: false, reason: 'no_consumption_lines' }
  }

  const movements: any[] = []
  for (const line of consumption) {
    const movement = await stockworksJson('/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(line),
    })
    movements.push(movement)
  }

  const nextMetadata = {
    ...metadata,
    stockworksConsumedAt: new Date().toISOString(),
    stockworksConsumption: consumption,
    stockworksConsumptionTrigger: trigger,
  }

  await prisma.printOrder.update({
    where: { id: order.id },
    data: { metadata: nextMetadata },
  })

  return { ok: true, movements: movements.length }
}
