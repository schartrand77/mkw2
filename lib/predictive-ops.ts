import { prisma } from '@/lib/db'
import { getDemandForecast } from '@/lib/demand-forecasting'
import { buildFleetIntelligence, type FleetPrinterRow } from '@/lib/fleet-intelligence'
import { buildWasteReport } from '@/lib/material-optimization'
import { getProductionSnapshot } from '@/lib/production'
import { stockworksJson, stockworksList } from '@/lib/stockworks-client'
import { buildConsumptionLinesForOrder, type InventoryItem } from '@/lib/stockworks-consumption'

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

type ForecastConfidence = 'low' | 'medium' | 'high'
type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

type WasteRow = Awaited<ReturnType<typeof buildWasteReport>>[number]
type ProductionSnapshot = Awaited<ReturnType<typeof getProductionSnapshot>>
type DemandForecast = Awaited<ReturnType<typeof getDemandForecast>>

export type SpoolForecast = {
  inventoryItemId: number
  material: string
  spoolLabel: string
  color: string | null
  quantityGrams: number
  reorderLevelGrams: number
  queuedUsageGrams: number
  projectedRemainingGrams: number
  projectedDaysToReorder: number | null
  confidenceWindowDays: { min: number | null; expected: number | null; max: number | null }
  confidence: ForecastConfidence
  risk: RiskLevel
  notes: string[]
}

export type DowntimeRisk = {
  printerId: string
  printerName: string
  score: number
  risk: RiskLevel
  staleHours: number | null
  averageUtilization: number
  maintenanceOverdueHours: number | null
  topSignals: string[]
}

export type SlaRiskWarning = {
  orderId: string
  orderNumber: number | null
  queuePosition: number | null
  status: string
  risk: RiskLevel
  score: number
  etaConfidenceScore: number | null
  expectedCompletionAt: string | null
  reasons: string[]
}

export type PredictiveOpsSnapshot = {
  generatedAt: string
  spoolForecasts: SpoolForecast[]
  downtimeRisks: DowntimeRisk[]
  slaWarnings: SlaRiskWarning[]
  slaSummary: {
    queueHours: number
    queueDays: number | null
    projectedBacklogDays: number | null
    incomingOrdersNext7Days: number
    incomingHoursNext7Days: number
    atRiskOrders: number
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function round2(value: number) {
  return Math.round(value * 100) / 100
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

function normalizeRisk(score: number): RiskLevel {
  if (score >= 0.85) return 'critical'
  if (score >= 0.65) return 'high'
  if (score >= 0.4) return 'medium'
  return 'low'
}

function normalizeConfidence(varianceRatio: number): ForecastConfidence {
  if (varianceRatio <= 0.15) return 'high'
  if (varianceRatio <= 0.35) return 'medium'
  return 'low'
}

function buildMaterialBurnRates(wasteReport: WasteRow[], days: number) {
  const burnRates = new Map<string, { dailyBurn: number; varianceRatio: number; confidence: ForecastConfidence }>()
  for (const row of wasteReport) {
    const material = normalizeMaterialKey(row.material)
    const actual = row.actualGrams > 0 ? row.actualGrams : row.estimatedGrams
    const dailyBurn = days > 0 ? actual / days : 0
    const baseline = Math.max(row.estimatedGrams, actual, 1)
    const varianceRatio = clamp(Math.abs(row.varianceGrams) / baseline, 0.05, 0.75)
    burnRates.set(material, {
      dailyBurn,
      varianceRatio,
      confidence: normalizeConfidence(varianceRatio),
    })
  }
  return burnRates
}

function allocateDailyBurn(args: {
  inventory: InventoryItem[]
  queuedUsageByItem: Map<number, number>
  burnRates: Map<string, { dailyBurn: number; varianceRatio: number; confidence: ForecastConfidence }>
}) {
  const itemsByMaterial = new Map<string, InventoryItem[]>()
  for (const item of args.inventory) {
    const material = normalizeMaterialKey(item.material?.filament_type)
    const entries = itemsByMaterial.get(material) || []
    entries.push(item)
    itemsByMaterial.set(material, entries)
  }

  const burnByItem = new Map<number, { dailyBurn: number; varianceRatio: number; confidence: ForecastConfidence }>()
  for (const [material, items] of itemsByMaterial.entries()) {
    const materialBurn = args.burnRates.get(material)
    const totalQueued = items.reduce((sum, item) => sum + (args.queuedUsageByItem.get(item.id) || 0), 0)
    for (const item of items) {
      const queuedShare = totalQueued > 0 ? (args.queuedUsageByItem.get(item.id) || 0) / totalQueued : 0
      const equalShare = items.length > 0 ? 1 / items.length : 0
      const share = queuedShare > 0 ? queuedShare : equalShare
      burnByItem.set(item.id, {
        dailyBurn: round2((materialBurn?.dailyBurn || 0) * share),
        varianceRatio: materialBurn?.varianceRatio ?? 0.35,
        confidence: materialBurn?.confidence ?? 'low',
      })
    }
  }

  return burnByItem
}

export function buildSpoolDepletionForecast(args: {
  inventory: InventoryItem[]
  queuedUsageByItem: Map<number, number>
  wasteReport: WasteRow[]
  historyDays?: number
}) {
  const historyDays = args.historyDays ?? 30
  const burnRates = buildMaterialBurnRates(args.wasteReport, historyDays)
  const burnByItem = allocateDailyBurn({
    inventory: args.inventory,
    queuedUsageByItem: args.queuedUsageByItem,
    burnRates,
  })

  return args.inventory
    .map((item) => {
      const quantityGrams = Math.max(0, Number(item.quantity_grams) || 0)
      const reorderLevelGrams = Math.max(0, Number(item.reorder_level) || 0)
      const queuedUsageGrams = round1(args.queuedUsageByItem.get(item.id) || 0)
      const projectedRemainingGrams = round1(quantityGrams - queuedUsageGrams)
      const burn = burnByItem.get(item.id) || { dailyBurn: 0, varianceRatio: 0.35, confidence: 'low' as const }
      const expectedDays = burn.dailyBurn > 0
        ? round1(Math.max(0, (projectedRemainingGrams - reorderLevelGrams) / burn.dailyBurn))
        : null
      const minDailyBurn = burn.dailyBurn * (1 + burn.varianceRatio)
      const maxDailyBurn = burn.dailyBurn * Math.max(0.35, 1 - burn.varianceRatio)
      const minDays = minDailyBurn > 0
        ? round1(Math.max(0, (projectedRemainingGrams - reorderLevelGrams) / minDailyBurn))
        : expectedDays
      const maxDays = maxDailyBurn > 0
        ? round1(Math.max(0, (projectedRemainingGrams - reorderLevelGrams) / maxDailyBurn))
        : expectedDays
      const score = clamp(
        (projectedRemainingGrams <= reorderLevelGrams ? 0.55 : 0)
          + (expectedDays != null && expectedDays <= 3 ? 0.35 : expectedDays != null && expectedDays <= 7 ? 0.2 : 0)
          + (queuedUsageGrams >= quantityGrams * 0.5 ? 0.2 : queuedUsageGrams > 0 ? 0.1 : 0),
        0,
        1,
      )
      const material = normalizeMaterialKey(item.material?.filament_type)
      const color = item.material?.color?.trim() || null
      const notes: string[] = []
      if (queuedUsageGrams > 0) notes.push(`${queuedUsageGrams.toFixed(1)} g already reserved by queued work.`)
      if (expectedDays != null && expectedDays <= 7) notes.push(`Projected to hit reorder level in about ${expectedDays} days.`)
      if (burn.dailyBurn <= 0) notes.push('No reliable historical burn rate yet; forecast is queue-weighted.')
      return {
        inventoryItemId: item.id,
        material,
        spoolLabel: item.material?.name || `${material}${color ? ` / ${color}` : ''}`,
        color,
        quantityGrams,
        reorderLevelGrams,
        queuedUsageGrams,
        projectedRemainingGrams,
        projectedDaysToReorder: expectedDays,
        confidenceWindowDays: { min: minDays, expected: expectedDays, max: maxDays },
        confidence: burn.confidence,
        risk: normalizeRisk(score),
        notes,
      } satisfies SpoolForecast
    })
    .sort((a, b) => b.projectedRemainingGrams - a.projectedRemainingGrams)
    .sort((a, b) => {
      const riskDelta = ['critical', 'high', 'medium', 'low'].indexOf(a.risk) - ['critical', 'high', 'medium', 'low'].indexOf(b.risk)
      if (riskDelta !== 0) return riskDelta
      return (a.projectedDaysToReorder ?? Number.MAX_SAFE_INTEGER) - (b.projectedDaysToReorder ?? Number.MAX_SAFE_INTEGER)
    })
}

export function buildPrinterDowntimeRisks(printers: FleetPrinterRow[], now = new Date()) {
  return printers
    .map((printer) => {
      const averageUtilization = printer.utilization.length > 0
        ? printer.utilization.reduce((sum, cell) => sum + cell.utilization, 0) / printer.utilization.length
        : 0
      const staleHours = printer.lastSeenAt
        ? (now.getTime() - printer.lastSeenAt.getTime()) / (1000 * 60 * 60)
        : null
      const activeHoursSinceMaintenance = printer.lastMaintenanceAt
        ? averageUtilization * printer.dailyCapacityHours * ((now.getTime() - printer.lastMaintenanceAt.getTime()) / (1000 * 60 * 60 * 24))
        : null
      const maintenanceOverdueHours =
        activeHoursSinceMaintenance != null && printer.maintenanceIntervalHours != null
          ? activeHoursSinceMaintenance - printer.maintenanceIntervalHours
          : null
      const score = clamp(
        (printer.successRate != null && printer.successRate < 0.85 ? 0.3 : printer.successRate != null && printer.successRate < 0.93 ? 0.15 : 0)
          + (printer.mtbfHours != null && printer.mtbfHours < 24 ? 0.2 : printer.mtbfHours != null && printer.mtbfHours < 48 ? 0.1 : 0)
          + (averageUtilization > 0.9 ? 0.2 : averageUtilization > 0.75 ? 0.12 : 0)
          + (staleHours != null && staleHours > 24 ? 0.35 : staleHours != null && staleHours > 8 ? 0.18 : 0)
          + (maintenanceOverdueHours != null && maintenanceOverdueHours > 12 ? 0.25 : maintenanceOverdueHours != null && maintenanceOverdueHours > 0 ? 0.12 : 0)
          + (!printer.active || ['offline', 'maintenance'].includes(printer.status) ? 0.2 : 0),
        0,
        1,
      )
      const topSignals: string[] = []
      if (printer.successRate != null && printer.successRate < 0.93) topSignals.push(`Success rate ${Math.round(printer.successRate * 100)}%.`)
      if (printer.mtbfHours != null && printer.mtbfHours < 48) topSignals.push(`MTBF ${round1(printer.mtbfHours)}h.`)
      if (averageUtilization > 0.75) topSignals.push(`Average utilization ${Math.round(averageUtilization * 100)}%.`)
      if (staleHours != null && staleHours > 8) topSignals.push(`Heartbeat stale by ${round1(staleHours)}h.`)
      if (maintenanceOverdueHours != null && maintenanceOverdueHours > 0) topSignals.push(`Maintenance overdue by ${round1(maintenanceOverdueHours)}h.`)
      if (topSignals.length === 0) topSignals.push('No elevated downtime signals.')

      return {
        printerId: printer.id,
        printerName: printer.name,
        score: round2(score),
        risk: normalizeRisk(score),
        staleHours: staleHours != null ? round1(staleHours) : null,
        averageUtilization: round2(averageUtilization),
        maintenanceOverdueHours: maintenanceOverdueHours != null ? round1(maintenanceOverdueHours) : null,
        topSignals,
      } satisfies DowntimeRisk
    })
    .sort((a, b) => b.score - a.score || a.printerName.localeCompare(b.printerName))
}

export function buildSlaRiskWarnings(args: {
  snapshot: ProductionSnapshot
  forecast: DemandForecast
}) {
  const avgHoursPerQueuedOrder = args.snapshot.orders.length > 0
    ? args.snapshot.queueHours / args.snapshot.orders.length
    : 2.5
  const incomingOrdersNext7Days = round1(
    args.forecast.forecast.slice(0, 7).reduce((sum, day) => sum + day.expectedOrders, 0),
  )
  const incomingHoursNext7Days = round1(incomingOrdersNext7Days * avgHoursPerQueuedOrder)
  const queueDays = args.snapshot.capacityHoursPerDay > 0
    ? round1(args.snapshot.queueHours / args.snapshot.capacityHoursPerDay)
    : null
  const projectedBacklogDays = args.snapshot.capacityHoursPerDay > 0
    ? round1((args.snapshot.queueHours + incomingHoursNext7Days) / args.snapshot.capacityHoursPerDay)
    : null

  const warnings = args.snapshot.orders
    .map((order) => {
      const ageHours = (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60)
      const etaHours = order.estimatedCompletionAt
        ? (new Date(order.estimatedCompletionAt).getTime() - Date.now()) / (1000 * 60 * 60)
        : null
      const score = clamp(
        (projectedBacklogDays != null && projectedBacklogDays > 4 ? 0.35 : projectedBacklogDays != null && projectedBacklogDays > 2.5 ? 0.18 : 0)
          + ((order.queuePosition ?? 0) > 8 ? 0.18 : (order.queuePosition ?? 0) > 4 ? 0.08 : 0)
          + (order.etaConfidenceScore != null && order.etaConfidenceScore < 0.6 ? 0.22 : order.etaConfidenceScore != null && order.etaConfidenceScore < 0.75 ? 0.1 : 0)
          + (etaHours != null && etaHours > 72 ? 0.18 : etaHours != null && etaHours > 36 ? 0.1 : 0)
          + (ageHours > 120 ? 0.18 : ageHours > 48 ? 0.08 : 0)
          + (order.orderWorksLastError ? 0.14 : 0),
        0,
        1,
      )
      const reasons: string[] = []
      if (projectedBacklogDays != null && projectedBacklogDays > 2.5) reasons.push(`Projected backlog reaches ${projectedBacklogDays} days.`)
      if ((order.queuePosition ?? 0) > 4) reasons.push(`Queue position ${order.queuePosition}.`)
      if (order.etaConfidenceScore != null && order.etaConfidenceScore < 0.75) reasons.push(`ETA confidence ${Math.round(order.etaConfidenceScore * 100)}%.`)
      if (etaHours != null && etaHours > 36) reasons.push(`Estimated completion is ${round1(etaHours)}h out.`)
      if (ageHours > 48) reasons.push(`Queued for ${round1(ageHours)}h.`)
      if (order.orderWorksLastError) reasons.push('Integration error still present on linked job.')
      if (reasons.length === 0) reasons.push('No elevated SLA risk signals.')
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        queuePosition: order.queuePosition,
        status: order.status,
        risk: normalizeRisk(score),
        score: round2(score),
        etaConfidenceScore: order.etaConfidenceScore,
        expectedCompletionAt: order.estimatedCompletionAt ? new Date(order.estimatedCompletionAt).toISOString() : null,
        reasons,
      } satisfies SlaRiskWarning
    })
    .filter((warning) => warning.risk !== 'low')
    .sort((a, b) => b.score - a.score || (a.queuePosition ?? 9999) - (b.queuePosition ?? 9999))

  return {
    warnings,
    summary: {
      queueHours: round1(args.snapshot.queueHours),
      queueDays,
      projectedBacklogDays,
      incomingOrdersNext7Days,
      incomingHoursNext7Days,
      atRiskOrders: warnings.length,
    },
  }
}

async function loadQueuedUsageByItem(cfg: unknown, inventory: InventoryItem[]) {
  const queuedUsageByItem = new Map<number, number>()
  if (inventory.length === 0) return queuedUsageByItem

  const queuedOrders = await prisma.printOrder.findMany({
    where: { status: { in: Array.from(QUEUE_STATUSES) } },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  })

  for (const order of queuedOrders) {
    const reference = order.orderNumber ? `MW-${String(order.orderNumber).padStart(5, '0')}` : order.id
    const { lines } = await buildConsumptionLinesForOrder(order, cfg, inventory, reference)
    for (const line of lines) {
      queuedUsageByItem.set(line.inventory_item_id, (queuedUsageByItem.get(line.inventory_item_id) || 0) + Math.abs(line.change_grams))
    }
  }

  return queuedUsageByItem
}

export async function buildPredictiveSpoolForecast() {
  const [cfg, wasteReport, inventory] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
    buildWasteReport(30).catch(() => []),
    stockworksJson('/inventory')
      .then((payload) => stockworksList<InventoryItem>(payload))
      .catch(() => [] as InventoryItem[]),
  ])
  const queuedUsageByItem = await loadQueuedUsageByItem(cfg, inventory)
  return buildSpoolDepletionForecast({
    inventory,
    queuedUsageByItem,
    wasteReport,
    historyDays: 30,
  })
}

export async function buildPredictiveDowntimeRisks() {
  const fleet = await buildFleetIntelligence(14)
  return buildPrinterDowntimeRisks(fleet)
}

export async function buildPredictiveSlaWarnings() {
  const [production, forecast] = await Promise.all([
    getProductionSnapshot(),
    getDemandForecast({ historyDays: 56, horizonDays: 30 }),
  ])
  return buildSlaRiskWarnings({ snapshot: production, forecast })
}

export async function buildPredictiveOpsSnapshot(): Promise<PredictiveOpsSnapshot> {
  const [spoolForecasts, downtimeRisks, sla] = await Promise.all([
    buildPredictiveSpoolForecast(),
    buildPredictiveDowntimeRisks(),
    buildPredictiveSlaWarnings(),
  ])

  return {
    generatedAt: new Date().toISOString(),
    spoolForecasts,
    downtimeRisks,
    slaWarnings: sla.warnings,
    slaSummary: sla.summary,
  }
}
