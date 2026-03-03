import { prisma } from '@/lib/db'
import { estimatePricingDetails } from '@/lib/pricing'
import { normalizeOrderStatus } from '@/lib/order-status'
import type { SiteConfig } from '@prisma/client'

type AnalyticsOrderSummary = {
  id: string
  orderNumber: number | null
  status: string
  createdAt: string
  revenueCents: number
  estimatedCostCents: number
  estimatedProfitCents: number
  estimatedHours: number
  coveragePct: number
}

type UtilizationDay = {
  date: string
  hours: number
  capacityHours: number
  utilizationPct: number
}

export type AnalyticsSnapshot = {
  generatedAt: string
  range: { days: number; start: string; end: string }
  summary: {
    orders: number
    revenueCents: number
    estimatedCostCents: number
    estimatedProfitCents: number
    estimatedHours: number
    profitPerHour: number | null
    utilizationPct: number | null
  }
  profitPerJob: AnalyticsOrderSummary[]
  revenueByMaterial: { material: string; revenueCents: number; quantity: number }[]
  failureRateByMaterial: { material: string; failedQty: number; totalQty: number; failureRate: number }[]
  failureRateByModel: { modelId: string; modelTitle: string; failedQty: number; totalQty: number; failureRate: number }[]
  utilization: {
    capacityHoursPerDay: number
    days: UtilizationDay[]
  }
  estimateCalibration: {
    samples: number
    avgHoursDelta: number | null
    avgAbsoluteHoursDelta: number | null
    avgMaterialGrams: number | null
    byMaterial: Array<{
      material: string
      samples: number
      avgHoursDelta: number
      avgAbsoluteHoursDelta: number
    }>
    byOrder: Array<{
      id: string
      orderNumber: number | null
      createdAt: string
      estimatedPrintHours: number
      actualPrintHours: number
      printHoursDelta: number
      actualMaterialGrams: number | null
    }>
  }
}

type ItemEstimate = {
  cost: number
  hours: number
  materialKey: string
}

type VolumeMaps = {
  modelVolumes: Map<string, number | null>
  modelTitles: Map<string, string>
  partVolumes: Map<string, number | null>
  partToModel: Map<string, string>
}

const DAY_MS = 24 * 60 * 60 * 1000

async function loadVolumeMaps(orderItems: { modelId?: string | null; partId?: string | null }[]): Promise<VolumeMaps> {
  const modelIds = Array.from(new Set(orderItems.map((item) => item.modelId).filter((id): id is string => Boolean(id))))
  const partIds = Array.from(new Set(orderItems.map((item) => item.partId).filter((id): id is string => Boolean(id))))
  const [models, parts] = await Promise.all([
    modelIds.length
      ? prisma.model.findMany({
          where: { id: { in: modelIds } },
          select: { id: true, volumeMm3: true, title: true },
        })
      : Promise.resolve([]),
    partIds.length
      ? prisma.modelPart.findMany({
          where: { id: { in: partIds } },
          select: { id: true, volumeMm3: true, modelId: true },
        })
      : Promise.resolve([]),
  ])

  return {
    modelVolumes: new Map(models.map((model) => [model.id, model.volumeMm3 ?? null])),
    modelTitles: new Map(models.map((model) => [model.id, model.title])),
    partVolumes: new Map(parts.map((part) => [part.id, part.volumeMm3 ?? null])),
    partToModel: new Map(parts.map((part) => [part.id, part.modelId])),
  }
}

function resolveColorCount(raw: unknown): number | null {
  if (Array.isArray(raw)) return raw.length
  if (raw && typeof raw === 'object') {
    const entries = Object.values(raw as Record<string, unknown>)
    return entries.length || null
  }
  return null
}

function estimateItem(
  item: {
    modelId?: string | null
    partId?: string | null
    material?: string | null
    infillPct?: number | null
    finish?: string | null
    quantity?: number | null
    colors?: unknown
  },
  maps: VolumeMaps,
  cfg?: Partial<SiteConfig> | null,
): ItemEstimate | null {
  const partVolume = item.partId ? maps.partVolumes.get(item.partId) : null
  const modelVolume = item.modelId ? maps.modelVolumes.get(item.modelId) : null
  const volumeMm3 = partVolume ?? modelVolume ?? null
  if (!volumeMm3 || !Number.isFinite(volumeMm3)) return null
  const cm3 = volumeMm3 / 1000
  const details = estimatePricingDetails({
    cm3,
    material: item.material ?? undefined,
    infillPct: item.infillPct ?? undefined,
    finish: item.finish ?? undefined,
    colorCount: resolveColorCount(item.colors),
    cfg,
    applyMinimum: false,
  })
  const qty = typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? Math.max(1, item.quantity) : 1
  const baseCost = details.materialCost + details.machineCost + details.energyCost + details.laborCost + details.extraHourlyCost
  const cost = baseCost * details.finishMultiplier * qty
  const hours = details.hours * qty
  return {
    cost,
    hours,
    materialKey: details.materialKey,
  }
}

function buildDayKeys(start: Date, end: Date): string[] {
  const days: string[] = []
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  while (cursor.getTime() <= endUtc.getTime()) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

export async function getAnalyticsSnapshot({ days = 30 }: { days?: number } = {}): Promise<AnalyticsSnapshot> {
  const safeDays = Number.isFinite(days) ? Math.min(365, Math.max(1, Math.floor(days))) : 30
  const end = new Date()
  const start = new Date(end.getTime() - safeDays * DAY_MS)

  const [cfg, printers, orders] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    prisma.printer.findMany({ select: { active: true, status: true, dailyCapacityHours: true } }),
    prisma.printOrder.findMany({
      where: { createdAt: { gte: start } },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    }),
  ])

  const allItems = orders.flatMap((order) => order.items)
  const volumeMaps = await loadVolumeMaps(allItems)

  const revenueByMaterial = new Map<string, { revenueCents: number; quantity: number }>()
  const failureByMaterial = new Map<string, { failedQty: number; totalQty: number }>()
  const failureByModel = new Map<string, { modelId: string; modelTitle: string; failedQty: number; totalQty: number }>()
  const utilizationByDay = new Map<string, number>()

  let totalRevenue = 0
  let totalCost = 0
  let totalHours = 0
  const calibrationRows: Array<AnalyticsSnapshot['estimateCalibration']['byOrder'][number] & { material: string }> = []

  const profitPerJob: AnalyticsOrderSummary[] = orders.map((order) => {
    const orderRevenue = Math.max(0, order.totalCents || 0)
    totalRevenue += orderRevenue
    let orderCost = 0
    let orderHours = 0
    let estimatedCount = 0
    const totalItems = order.items.length
    const failed = normalizeOrderStatus(order.status) === 'failed' || Boolean(order.failedAt)

    for (const item of order.items) {
      const material = (item.material || 'UNKNOWN').toUpperCase()
      const entry = revenueByMaterial.get(material) || { revenueCents: 0, quantity: 0 }
      entry.revenueCents += Math.max(0, item.totalCents || 0)
      entry.quantity += item.quantity || 1
      revenueByMaterial.set(material, entry)

      const failureMaterial = failureByMaterial.get(material) || { failedQty: 0, totalQty: 0 }
      const qty = item.quantity || 1
      failureMaterial.totalQty += qty
      if (failed) failureMaterial.failedQty += qty
      failureByMaterial.set(material, failureMaterial)

      const modelId = item.modelId || (item.partId ? volumeMaps.partToModel.get(item.partId) : null)
      if (modelId) {
        const modelTitle = volumeMaps.modelTitles.get(modelId) || 'Untitled model'
        const modelEntry = failureByModel.get(modelId) || {
          modelId,
          modelTitle,
          failedQty: 0,
          totalQty: 0,
        }
        modelEntry.totalQty += qty
        if (failed) modelEntry.failedQty += qty
        failureByModel.set(modelId, modelEntry)
      }

      const estimate = estimateItem(item, volumeMaps, cfg)
      if (estimate) {
        orderCost += estimate.cost
        orderHours += estimate.hours
        estimatedCount += 1
      }
    }

    totalCost += orderCost
    totalHours += orderHours

    if (order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)) {
      const feedback = (order.metadata as Record<string, unknown>).estimateFeedback
      if (feedback && typeof feedback === 'object' && !Array.isArray(feedback)) {
        const estimatedPrintHours = Number((feedback as Record<string, unknown>).estimatedPrintHours)
        const actualPrintHours = Number((feedback as Record<string, unknown>).actualPrintHours)
        const printHoursDelta = Number((feedback as Record<string, unknown>).printHoursDelta)
        const actualMaterialGrams = Number((feedback as Record<string, unknown>).actualMaterialGrams)
        if (Number.isFinite(estimatedPrintHours) && Number.isFinite(actualPrintHours) && Number.isFinite(printHoursDelta)) {
          const material = String(order.items[0]?.material || 'UNKNOWN').toUpperCase()
          calibrationRows.push({
            id: order.id,
            orderNumber: order.orderNumber,
            createdAt: order.createdAt.toISOString(),
            estimatedPrintHours,
            actualPrintHours,
            printHoursDelta,
            actualMaterialGrams: Number.isFinite(actualMaterialGrams) ? actualMaterialGrams : null,
            material,
          })
        }
      }
    }

    const dayKey = order.createdAt.toISOString().slice(0, 10)
    utilizationByDay.set(dayKey, (utilizationByDay.get(dayKey) || 0) + orderHours)

    const coveragePct = totalItems > 0 ? Math.round((estimatedCount / totalItems) * 100) : 0
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      revenueCents: orderRevenue,
      estimatedCostCents: Math.round(orderCost * 100),
      estimatedProfitCents: Math.round((orderRevenue / 100 - orderCost) * 100),
      estimatedHours: Number(orderHours.toFixed(2)),
      coveragePct,
    }
  })

  const capacityHoursPerDay = printers
    .filter((printer) => printer.active && ['available', 'printing'].includes(printer.status))
    .reduce((sum, printer) => sum + (Number.isFinite(printer.dailyCapacityHours) ? printer.dailyCapacityHours : 0), 0)

  const dayKeys = buildDayKeys(start, end)
  const utilizationDays = dayKeys.map((day) => {
    const hours = utilizationByDay.get(day) || 0
    const utilizationPct = capacityHoursPerDay > 0 ? Math.min(999, (hours / capacityHoursPerDay) * 100) : 0
    return {
      date: day,
      hours: Number(hours.toFixed(2)),
      capacityHours: Number(capacityHoursPerDay.toFixed(2)),
      utilizationPct: Number(utilizationPct.toFixed(1)),
    }
  })

  const revenueByMaterialRows = Array.from(revenueByMaterial.entries())
    .map(([material, values]) => ({ material, revenueCents: values.revenueCents, quantity: values.quantity }))
    .sort((a, b) => b.revenueCents - a.revenueCents)

  const failureByMaterialRows = Array.from(failureByMaterial.entries())
    .map(([material, values]) => ({
      material,
      failedQty: values.failedQty,
      totalQty: values.totalQty,
      failureRate: values.totalQty > 0 ? values.failedQty / values.totalQty : 0,
    }))
    .sort((a, b) => b.failureRate - a.failureRate)

  const failureByModelRows = Array.from(failureByModel.values())
    .map((entry) => ({
      ...entry,
      failureRate: entry.totalQty > 0 ? entry.failedQty / entry.totalQty : 0,
    }))
    .sort((a, b) => b.failureRate - a.failureRate)

  const estimatedProfit = totalRevenue / 100 - totalCost
  const profitPerHour = totalHours > 0 ? estimatedProfit / totalHours : null
  const avgUtilization = utilizationDays.length
    ? utilizationDays.reduce((sum, day) => sum + day.utilizationPct, 0) / utilizationDays.length
    : null
  const avgHoursDelta = calibrationRows.length > 0
    ? calibrationRows.reduce((sum, row) => sum + row.printHoursDelta, 0) / calibrationRows.length
    : null
  const avgAbsoluteHoursDelta = calibrationRows.length > 0
    ? calibrationRows.reduce((sum, row) => sum + Math.abs(row.printHoursDelta), 0) / calibrationRows.length
    : null
  const calibrationMaterialRows = calibrationRows.filter((row) => typeof row.actualMaterialGrams === 'number')
  const avgMaterialGrams = calibrationMaterialRows.length > 0
    ? calibrationMaterialRows.reduce((sum, row) => sum + (row.actualMaterialGrams || 0), 0) / calibrationMaterialRows.length
    : null
  const calibrationByMaterial = Array.from(calibrationRows.reduce((map, row) => {
    const current = map.get(row.material) || { material: row.material, samples: 0, totalDelta: 0, totalAbsDelta: 0 }
    current.samples += 1
    current.totalDelta += row.printHoursDelta
    current.totalAbsDelta += Math.abs(row.printHoursDelta)
    map.set(row.material, current)
    return map
  }, new Map<string, { material: string; samples: number; totalDelta: number; totalAbsDelta: number }>() ).values())
    .map((row) => ({
      material: row.material,
      samples: row.samples,
      avgHoursDelta: Number((row.totalDelta / row.samples).toFixed(2)),
      avgAbsoluteHoursDelta: Number((row.totalAbsDelta / row.samples).toFixed(2)),
    }))
    .sort((a, b) => b.avgAbsoluteHoursDelta - a.avgAbsoluteHoursDelta)

  return {
    generatedAt: new Date().toISOString(),
    range: {
      days: safeDays,
      start: start.toISOString(),
      end: end.toISOString(),
    },
    summary: {
      orders: orders.length,
      revenueCents: totalRevenue,
      estimatedCostCents: Math.round(totalCost * 100),
      estimatedProfitCents: Math.round(estimatedProfit * 100),
      estimatedHours: Number(totalHours.toFixed(2)),
      profitPerHour: profitPerHour != null ? Number(profitPerHour.toFixed(2)) : null,
      utilizationPct: avgUtilization != null ? Number(avgUtilization.toFixed(1)) : null,
    },
    profitPerJob,
    revenueByMaterial: revenueByMaterialRows,
    failureRateByMaterial: failureByMaterialRows,
    failureRateByModel: failureByModelRows,
    utilization: {
      capacityHoursPerDay: Number(capacityHoursPerDay.toFixed(2)),
      days: utilizationDays,
    },
    estimateCalibration: {
      samples: calibrationRows.length,
      avgHoursDelta: avgHoursDelta != null ? Number(avgHoursDelta.toFixed(2)) : null,
      avgAbsoluteHoursDelta: avgAbsoluteHoursDelta != null ? Number(avgAbsoluteHoursDelta.toFixed(2)) : null,
      avgMaterialGrams: avgMaterialGrams != null ? Number(avgMaterialGrams.toFixed(1)) : null,
      byMaterial: calibrationByMaterial,
      byOrder: calibrationRows
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20)
        .map(({ material: _material, ...row }) => row),
    },
  }
}
