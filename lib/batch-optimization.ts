import { prisma } from '@/lib/db'
import { estimatePricingDetails } from '@/lib/pricing'
import { normalizeOrderStatus } from '@/lib/order-status'
import type { SiteConfig } from '@prisma/client'

const QUEUE_STATUSES = new Set([
  'queued',
  'printing',
  'post_process',
  'failed',
  'awaiting_review',
  'awaiting_payment',
  'in_production',
  'ready',
])

type OrderItem = {
  modelId?: string | null
  partId?: string | null
  material?: string | null
  infillPct?: number | null
  finish?: string | null
  quantity?: number | null
  configuration?: any
  colors?: any
}

type BatchGroup = {
  key: string
  material: string
  colors: string[]
  orders: Array<{ id: string; orderNumber: number | null; status: string; totalHours: number }>
  totalHours: number
}

type NestingBatch = {
  totalHours: number
  orders: Array<{ id: string; orderNumber: number | null; status: string; totalHours: number }>
}

export type NestingSuggestion = {
  key: string
  material: string
  colors: string[]
  targetHours: number
  batches: NestingBatch[]
}

export type PrintClusterPlan = {
  material: string
  colors: string[]
  printerId: string | null
  printerName: string
  jobs: Array<{ id: string; orderNumber: number | null; totalHours: number }>
  totalHours: number
}

export async function buildPrintClusterPlan() {
  const [cfg, printers] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    prisma.printer.findMany({ orderBy: { name: 'asc' } }),
  ])
  const { groups } = await buildBatchGroups()
  const activePrinters = printers.filter((printer) => printer.active)
  const queue: PrintClusterPlan[] = []
  const printerLoad = new Map<string, number>()
  for (const printer of activePrinters) {
    printerLoad.set(printer.id, 0)
  }

  for (const group of groups) {
    const jobs = group.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      totalHours: order.totalHours,
    }))
    const totalHours = group.totalHours
    const assigned = activePrinters.length
      ? activePrinters.reduce((best, printer) => {
          const load = printerLoad.get(printer.id) || 0
          const capacity = Number.isFinite(printer.dailyCapacityHours) ? printer.dailyCapacityHours : 0
          const projected = capacity > 0 ? load / capacity : load
          if (!best) return { printer, projected }
          return projected < best.projected ? { printer, projected } : best
        }, null as { printer: typeof activePrinters[number]; projected: number } | null)
      : null
    if (assigned) {
      const load = printerLoad.get(assigned.printer.id) || 0
      printerLoad.set(assigned.printer.id, load + totalHours)
    }
    queue.push({
      material: group.material,
      colors: group.colors,
      printerId: assigned?.printer.id || null,
      printerName: assigned?.printer.name || 'Unassigned',
      jobs,
      totalHours,
    })
  }

  const totalCapacity = activePrinters.reduce((sum, p) => sum + (Number.isFinite(p.dailyCapacityHours) ? p.dailyCapacityHours : 0), 0)
  const utilization = totalCapacity > 0
    ? queue.reduce((sum, entry) => sum + entry.totalHours, 0) / totalCapacity
    : 0

  return {
    clusters: queue,
    utilization,
    activePrinters: activePrinters.map((printer) => ({
      id: printer.id,
      name: printer.name,
      dailyCapacityHours: printer.dailyCapacityHours,
      loadHours: printerLoad.get(printer.id) || 0,
    })),
  }
}

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

async function loadVolumeMaps(orderItems: OrderItem[]) {
  const modelIds = Array.from(new Set(orderItems.map((item) => item.modelId).filter((id): id is string => Boolean(id))))
  const partIds = Array.from(new Set(orderItems.map((item) => item.partId).filter((id): id is string => Boolean(id))))
  const [models, parts] = await Promise.all([
    modelIds.length
      ? prisma.model.findMany({
          where: { id: { in: modelIds } },
          select: { id: true, volumeMm3: true, supportRatio: true },
        })
      : Promise.resolve([]),
    partIds.length
      ? prisma.modelPart.findMany({
          where: { id: { in: partIds } },
          select: { id: true, volumeMm3: true, supportRatio: true },
        })
      : Promise.resolve([]),
  ])
  return {
    modelVolumes: new Map(models.map((model) => [model.id, { volume: model.volumeMm3 ?? null, supportRatio: model.supportRatio ?? null }])),
    partVolumes: new Map(parts.map((part) => [part.id, { volume: part.volumeMm3 ?? null, supportRatio: part.supportRatio ?? null }])),
  }
}

function estimateOrderHours(
  items: OrderItem[],
  volumes: {
    modelVolumes: Map<string, { volume: number | null; supportRatio: number | null }>
    partVolumes: Map<string, { volume: number | null; supportRatio: number | null }>
  },
  cfg?: Partial<SiteConfig> | null,
) {
  return items.reduce((sum, item) => {
    const part = item.partId ? volumes.partVolumes.get(item.partId) : null
    const model = item.modelId ? volumes.modelVolumes.get(item.modelId) : null
    const volumeMm3 = part?.volume ?? model?.volume ?? null
    if (!volumeMm3 || !Number.isFinite(volumeMm3)) return sum
    const supportRatio = part?.supportRatio ?? model?.supportRatio ?? null
    const { sx, sy, sz } = resolveScale(item.configuration)
    const volumeMultiplier = sx * sy * sz
    const cm3 = (volumeMm3 / 1000) * volumeMultiplier
    const details = estimatePricingDetails({
      cm3,
      material: item.material ?? undefined,
      infillPct: item.infillPct ?? undefined,
      finish: item.finish ?? undefined,
      supportRatio,
      cfg,
      applyMinimum: false,
    })
    const qty = typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? Math.max(1, item.quantity) : 1
    return sum + details.hours * qty
  }, 0)
}

function extractOrderColors(items: OrderItem[]) {
  const all: string[] = []
  for (const item of items) {
    const colors = Array.isArray(item.colors)
      ? item.colors.filter((entry): entry is string => typeof entry === 'string')
      : []
    all.push(...colors.map((c) => normalizeColor(c)))
  }
  return Array.from(new Set(all.filter(Boolean))).sort()
}

export async function buildBatchGroups() {
  const [cfg, orders] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    prisma.printOrder.findMany({
      where: { status: { in: Array.from(QUEUE_STATUSES) } },
      orderBy: { createdAt: 'asc' },
      include: { items: true },
    }),
  ])
  const normalized = orders
    .map((order) => ({ ...order, normalizedStatus: normalizeOrderStatus(order.status) }))
    .filter((order) => QUEUE_STATUSES.has(order.status) || ['queued', 'printing', 'post_process'].includes(order.normalizedStatus))

  const allItems = normalized.flatMap((order) => order.items as OrderItem[])
  const volumes = await loadVolumeMaps(allItems)

  const groups = new Map<string, BatchGroup>()
  for (const order of normalized) {
    const material = normalizeMaterialKey(order.items[0]?.material ?? null)
    const colors = extractOrderColors(order.items as OrderItem[])
    const key = `${material}::${colors.join('|')}`
    const totalHours = estimateOrderHours(order.items as OrderItem[], volumes, cfg)
    const entry: BatchGroup = groups.get(key) || {
      key,
      material,
      colors,
      orders: [],
      totalHours: 0,
    }
    entry.orders.push({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalHours,
    })
    entry.totalHours += totalHours
    groups.set(key, entry)
  }

  const list = Array.from(groups.values()).sort((a, b) => b.orders.length - a.orders.length || b.totalHours - a.totalHours)

  const optimizedQueue = list
    .slice()
    .sort((a, b) => a.material.localeCompare(b.material) || a.colors.join('|').localeCompare(b.colors.join('|')))
    .flatMap((group) => group.orders.sort((a, b) => b.totalHours - a.totalHours))

  return { groups: list, optimizedQueue }
}

export async function buildNestingSuggestions(targetHours = 6, maxItems = 6) {
  const { groups } = await buildBatchGroups()
  const suggestions: NestingSuggestion[] = []

  for (const group of groups) {
    const remaining = [...group.orders].sort((a, b) => b.totalHours - a.totalHours)
    const batches: NestingBatch[] = []
    while (remaining.length) {
      const batch: NestingBatch = { totalHours: 0, orders: [] }
      for (let i = 0; i < remaining.length; i += 1) {
        if (batch.orders.length >= maxItems) break
        const candidate = remaining[i]
        if (!candidate) continue
        if (batch.totalHours + candidate.totalHours <= targetHours || batch.orders.length === 0) {
          batch.orders.push(candidate)
          batch.totalHours += candidate.totalHours
          remaining.splice(i, 1)
          i -= 1
        }
      }
      if (batch.orders.length === 0) {
        batch.orders.push(remaining.shift()!)
        batch.totalHours = batch.orders[0].totalHours
      }
      batches.push(batch)
    }
    suggestions.push({
      key: group.key,
      material: group.material,
      colors: group.colors,
      targetHours,
      batches,
    })
  }

  return suggestions
}
