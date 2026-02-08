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
  'shipped',
  'completed',
])

type UtilizationCell = {
  date: string
  hours: number
  capacity: number
  utilization: number
}

export type FleetPrinterRow = {
  id: string
  name: string
  status: string
  active: boolean
  dailyCapacityHours: number
  lastMaintenanceAt?: Date | null
  maintenanceIntervalHours?: number | null
  maintenanceNotes?: string | null
  utilization: UtilizationCell[]
  successRate: number | null
  mtbfHours: number | null
  failures: number
  completed: number
}

type OrderItem = {
  modelId?: string | null
  partId?: string | null
  material?: string | null
  infillPct?: number | null
  finish?: string | null
  quantity?: number | null
  configuration?: any
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

function formatDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

function buildDateRange(days: number) {
  const result: string[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    result.push(formatDay(d))
  }
  return result
}

export async function buildFleetIntelligence(days = 14): Promise<FleetPrinterRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const [cfg, printers, orders] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    prisma.printer.findMany({ orderBy: { name: 'asc' } }),
    prisma.printOrder.findMany({
      where: {
        printerId: { not: null },
        createdAt: { gte: since },
        status: { in: Array.from(QUEUE_STATUSES) },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const allItems = orders.flatMap((order) => order.items)
  const volumeMaps = await loadVolumeMaps(allItems)
  const dateRange = buildDateRange(days)

  const rows: FleetPrinterRow[] = printers.map((printer) => {
    const printerOrders = orders.filter((order) => order.printerId === printer.id)
    const dayTotals = new Map<string, number>()
    let failures = 0
    let completed = 0
    const failureTimes: number[] = []

    for (const order of printerOrders) {
      const normalized = normalizeOrderStatus(order.status)
      if (normalized === 'failed' || order.failedAt) {
        failures += 1
        if (order.failedAt) failureTimes.push(new Date(order.failedAt).getTime())
      }
      if (normalized === 'completed' || normalized === 'shipped' || normalized === 'post_process') {
        completed += 1
      }
      const hours = estimateOrderHours(order.items as OrderItem[], volumeMaps, cfg)
      const dayKey = formatDay(order.createdAt)
      dayTotals.set(dayKey, (dayTotals.get(dayKey) || 0) + hours)
    }

    const utilization: UtilizationCell[] = dateRange.map((day) => {
      const hours = dayTotals.get(day) || 0
      const capacity = Number.isFinite(printer.dailyCapacityHours) ? printer.dailyCapacityHours : 0
      const utilizationPct = capacity > 0 ? Math.min(1, hours / capacity) : 0
      return { date: day, hours, capacity, utilization: utilizationPct }
    })

    const successRate = (completed + failures) > 0 ? completed / (completed + failures) : null
    const sortedFailures = failureTimes.sort((a, b) => a - b)
    const mtbfHours = sortedFailures.length >= 2
      ? (() => {
          let total = 0
          for (let i = 1; i < sortedFailures.length; i += 1) {
            total += (sortedFailures[i] - sortedFailures[i - 1]) / (1000 * 60 * 60)
          }
          return total / (sortedFailures.length - 1)
        })()
      : null

    return {
      id: printer.id,
      name: printer.name,
      status: printer.status,
      active: printer.active,
      dailyCapacityHours: printer.dailyCapacityHours,
      lastMaintenanceAt: printer.lastMaintenanceAt ?? null,
      maintenanceIntervalHours: printer.maintenanceIntervalHours ?? null,
      maintenanceNotes: printer.maintenanceNotes ?? null,
      utilization,
      successRate,
      mtbfHours,
      failures,
      completed,
    }
  })

  return rows
}
