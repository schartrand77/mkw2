import { prisma } from '@/lib/db'
import { estimatePricingDetails } from '@/lib/pricing'
import { normalizeOrderStatus } from '@/lib/order-status'
import { stockworksJson, stockworksList } from '@/lib/stockworks-client'

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

const normalizeMaterialKey = (value?: string | null) => {
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

const normalizeColor = (value?: string | null) => (value || '').trim().toLowerCase()

const extractSlicerStats = (metadata: Record<string, any> | null) => {
  const raw = metadata?.slicerStats
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const materials = Array.isArray((raw as any).materials) ? (raw as any).materials : []
  return materials
    .map((entry: any) => {
      if (!entry || typeof entry !== 'object') return null
      const material = typeof entry.material === 'string' ? entry.material : null
      const grams = Number(entry.grams)
      if (!material || !Number.isFinite(grams) || grams <= 0) return null
      const colors = Array.isArray(entry.colors)
        ? entry.colors.filter((c: any) => typeof c === 'string')
        : typeof entry.color === 'string'
          ? [entry.color]
          : []
      return { material, colors, grams }
    })
    .filter(Boolean) as { material: string; colors: string[]; grams: number }[]
}

const resolveScale = (config: any) => {
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

type WasteMaterialSummary = {
  material: string
  estimatedGrams: number
  actualGrams: number
  varianceGrams: number
  coverageOrders: number
  totalOrders: number
}

export async function buildWasteReport(days = 30): Promise<WasteMaterialSummary[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const [cfg, orders] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    prisma.printOrder.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    }),
  ])

  const totals = new Map<string, WasteMaterialSummary>()
  for (const order of orders) {
    const normalized = normalizeOrderStatus(order.status)
    if (!['queued', 'printing', 'post_process', 'shipped', 'completed'].includes(normalized)) {
      continue
    }
    const metadata = order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
      ? (order.metadata as Record<string, any>)
      : null
    const slicer = extractSlicerStats(metadata)
    const slicerMap = new Map<string, number>()
    slicer.forEach((entry) => {
      const key = normalizeMaterialKey(entry.material)
      slicerMap.set(key, (slicerMap.get(key) || 0) + entry.grams)
    })

    const modelIds = Array.from(new Set(order.items.map((i) => i.modelId).filter(Boolean))) as string[]
    const partIds = Array.from(new Set(order.items.map((i) => i.partId).filter(Boolean))) as string[]
    const [models, parts] = await Promise.all([
      modelIds.length ? prisma.model.findMany({ where: { id: { in: modelIds } }, select: { id: true, volumeMm3: true, supportRatio: true } }) : [],
      partIds.length ? prisma.modelPart.findMany({ where: { id: { in: partIds } }, select: { id: true, volumeMm3: true, supportRatio: true, modelId: true } }) : [],
    ])
    const modelMap = new Map(models.map((m) => [m.id, m]))
    const partMap = new Map(parts.map((p) => [p.id, p]))

    const estimateByMaterial = new Map<string, number>()
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
        material: item.material ?? undefined,
        infillPct: item.infillPct ?? undefined,
        finish: item.finish ?? undefined,
        supportRatio,
        colorCount: Array.isArray(item.colors) ? item.colors.length : null,
        cfg,
        applyMinimum: false,
      })
      const grams = breakdown.grams * qty
      const materialKey = normalizeMaterialKey(item.material ?? undefined)
      estimateByMaterial.set(materialKey, (estimateByMaterial.get(materialKey) || 0) + grams)
    }

    const materials = new Set([...estimateByMaterial.keys(), ...slicerMap.keys()])
    for (const material of materials) {
      const summary = totals.get(material) || {
        material,
        estimatedGrams: 0,
        actualGrams: 0,
        varianceGrams: 0,
        coverageOrders: 0,
        totalOrders: 0,
      }
      summary.totalOrders += 1
      const est = estimateByMaterial.get(material) || 0
      const actual = slicerMap.get(material) || 0
      summary.estimatedGrams += est
      if (actual > 0) {
        summary.actualGrams += actual
        summary.coverageOrders += 1
      }
      summary.varianceGrams = summary.actualGrams - summary.estimatedGrams
      totals.set(material, summary)
    }
  }

  return Array.from(totals.values()).sort((a, b) => Math.abs(b.varianceGrams) - Math.abs(a.varianceGrams))
}

type StockworksColor = { name: string; hex?: string | null; brand?: string | null; category?: string | null }
type StockworksMaterialLike = {
  filament_type?: string | null
  color?: string | null
  color_hex?: string | null
  color_hex_code?: string | null
  hex?: string | null
  brand?: string | null
  category?: string | null
}
type StockworksInventoryLike = {
  quantity_grams?: number | null
  material?: StockworksMaterialLike | null
}

const hexToRgb = (hex?: string | null) => {
  if (!hex) return null
  const cleaned = hex.replace('#', '').trim()
  if (!/^[0-9a-f]{6}$/i.test(cleaned)) return null
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  return { r, g, b }
}

const colorDistance = (a?: string | null, b?: string | null) => {
  const left = hexToRgb(a)
  const right = hexToRgb(b)
  if (!left || !right) return null
  const dr = left.r - right.r
  const dg = left.g - right.g
  const db = left.b - right.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

export type ColorSuggestion = {
  material: string
  target: StockworksColor
  alternatives: StockworksColor[]
}

export async function buildColorSimilaritySuggestions(): Promise<ColorSuggestion[]> {
  const data = stockworksList<StockworksMaterialLike>(await stockworksJson('/materials'))
  const inventory = stockworksList<StockworksInventoryLike>(await stockworksJson('/inventory'))
  const colorsByType = new Map<string, { inStock: StockworksColor[]; orderable: StockworksColor[] }>()

  const toColor = (material: any): StockworksColor | null => {
    const name = (material?.color || '').trim()
    const hex = material?.color_hex || material?.color_hex_code || material?.hex || null
    if (!name && !hex) return null
    return { name: name || hex || 'Unknown', hex, brand: material?.brand || null, category: material?.category || null }
  }

  for (const material of data) {
    const typeKey = normalizeMaterialKey(material?.filament_type)
    const color = toColor(material)
    if (!color) continue
    if (!colorsByType.has(typeKey)) {
      colorsByType.set(typeKey, { inStock: [], orderable: [] })
    }
    colorsByType.get(typeKey)!.orderable.push(color)
  }

  for (const item of inventory) {
    const qty = Number(item?.quantity_grams || 0)
    if (qty <= 0) continue
    const material = item?.material || null
    const typeKey = normalizeMaterialKey(material?.filament_type)
    const color = toColor(material)
    if (!color) continue
    if (!colorsByType.has(typeKey)) {
      colorsByType.set(typeKey, { inStock: [], orderable: [] })
    }
    colorsByType.get(typeKey)!.inStock.push(color)
  }

  const suggestions: ColorSuggestion[] = []
  for (const [material, palette] of colorsByType.entries()) {
    const inStock = palette.inStock
    if (inStock.length === 0) continue
    for (const target of palette.orderable) {
      const isInStock = inStock.some((c) => normalizeColor(c.name) === normalizeColor(target.name))
      if (isInStock) continue
      const ranked = inStock
        .map((candidate) => ({
          candidate,
          distance: colorDistance(target.hex, candidate.hex),
        }))
        .filter((entry) => entry.distance != null)
        .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
        .slice(0, 3)
        .map((entry) => entry.candidate)
      if (ranked.length) {
        suggestions.push({ material, target, alternatives: ranked })
      }
    }
  }

  return suggestions.slice(0, 30)
}

export type AlternateMaterialSuggestion = {
  material: string
  availableAlternates: { material: string; grams: number }[]
}

export async function buildAlternateMaterialSuggestions(): Promise<AlternateMaterialSuggestion[]> {
  const inventory = stockworksList<StockworksInventoryLike>(await stockworksJson('/inventory'))
  const totals = new Map<string, number>()
  for (const item of inventory) {
    const qty = Number(item?.quantity_grams || 0)
    const material = item?.material || null
    const typeKey = normalizeMaterialKey(material?.filament_type)
    totals.set(typeKey, (totals.get(typeKey) || 0) + Math.max(0, qty))
  }
  const entries = Array.from(totals.entries())
  const available = entries.filter(([, grams]) => grams > 0).sort((a, b) => b[1] - a[1])
  const depleted = entries.filter(([, grams]) => grams <= 0)

  return depleted.map(([material]) => ({
    material,
    availableAlternates: available.slice(0, 3).map(([alt, grams]) => ({ material: alt, grams })),
  }))
}
