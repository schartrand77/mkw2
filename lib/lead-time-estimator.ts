import { prisma } from '@/lib/db'
import { getProductionSnapshot } from '@/lib/production'
import { stockworksFetch } from '@/lib/stockworks-client'
import { normalizeMaterialName } from '@/lib/cartPricing'

export type LeadTimeEstimate = {
  hours: number
  minHours: number
  maxHours: number
  confidenceScore: number
  signals: {
    baseHours: number
    queueHours: number
    queueDelayHours: number
    capacityHoursPerDay: number
    printerAvailabilityPercent: number
    materialAvailability: 'in_stock' | 'limited' | 'out_of_stock' | 'unknown'
  }
}

type StockworksInventoryRow = {
  quantity?: number | null
  grams?: number | null
  remaining_grams?: number | null
  stock?: number | null
  material?: {
    filament_type?: string | null
  } | null
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeMaterialKey(material?: string | null) {
  const key = normalizeMaterialName(material || 'PLA')
  if (key.includes('PA6')) return 'PA6'
  if (key.includes('PA12')) return 'PA12'
  if (key.includes('NYLON')) return 'NYLON'
  if (key.includes('TPU')) return 'TPU'
  if (key.includes('ASA')) return 'ASA'
  if (key.includes('ABS')) return 'ABS'
  if (key.includes('PETG')) return 'PETG'
  if (key.includes('PC')) return 'PC'
  if (key.includes('RESIN')) return 'RESIN'
  return 'PLA'
}

async function resolveMaterialAvailability(material: string): Promise<'in_stock' | 'limited' | 'out_of_stock' | 'unknown'> {
  let timeout: ReturnType<typeof setTimeout> | null = null
  try {
    const controller = new AbortController()
    timeout = setTimeout(() => controller.abort(), 1200)
    const response = await stockworksFetch('/inventory', { signal: controller.signal })
    clearTimeout(timeout)
    timeout = null
    if (!response.ok) return 'unknown'
    const inventory = await response.json() as unknown
    if (!Array.isArray(inventory)) return 'unknown'

    const materialKey = normalizeMaterialKey(material)
    const matching = (inventory as StockworksInventoryRow[]).filter((entry) => {
      const type = normalizeMaterialKey(entry.material?.filament_type || '')
      return type === materialKey
    })
    if (matching.length === 0) return 'unknown'

    const positiveCount = matching.filter((entry) => {
      const qty = Number(
        entry.quantity
        ?? entry.grams
        ?? entry.remaining_grams
        ?? entry.stock
        ?? 0,
      )
      return Number.isFinite(qty) && qty > 0
    }).length

    if (positiveCount === 0) return 'out_of_stock'
    if (positiveCount <= Math.max(1, Math.floor(matching.length * 0.2))) return 'limited'
    return 'in_stock'
  } catch {
    return 'unknown'
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function estimateLeadTimeHours(args: {
  baseHours: number
  material: string
}): Promise<LeadTimeEstimate> {
  const baseHours = Number.isFinite(args.baseHours) ? Math.max(0.25, args.baseHours) : 1

  const [snapshot, printers, materialAvailability] = await Promise.all([
    getProductionSnapshot(),
    prisma.printer.findMany({
      select: { active: true, status: true },
    }),
    resolveMaterialAvailability(args.material),
  ])

  const activePrinters = printers.filter((printer) => printer.active)
  const availablePrinters = activePrinters.filter((printer) => {
    const normalized = (printer.status || '').trim().toLowerCase()
    return normalized === 'available' || normalized === 'printing'
  })
  const printerAvailabilityPercent = activePrinters.length > 0
    ? clamp((availablePrinters.length / activePrinters.length) * 100, 0, 100)
    : 0

  const queueHours = snapshot.queueHours
  const capacityHoursPerDay = snapshot.capacityHoursPerDay
  const queueDelayHours = capacityHoursPerDay > 0
    ? (queueHours / capacityHoursPerDay) * 24
    : baseHours * 4

  const queueWeightHours = queueDelayHours * 0.35
  const printerFactor = printerAvailabilityPercent >= 75 ? 1 : printerAvailabilityPercent >= 50 ? 1.08 : 1.18
  const materialFactor = materialAvailability === 'in_stock'
    ? 1
    : materialAvailability === 'limited'
      ? 1.12
      : materialAvailability === 'out_of_stock'
        ? 1.4
        : 1.08

  const rawHours = (baseHours + queueWeightHours) * printerFactor * materialFactor
  const hours = round1(Math.max(baseHours, rawHours))

  let confidence = 0.84
  if (capacityHoursPerDay <= 0) confidence -= 0.32
  else if (queueHours > capacityHoursPerDay * 6) confidence -= 0.18
  else if (queueHours > capacityHoursPerDay * 3) confidence -= 0.08
  if (printerAvailabilityPercent < 50) confidence -= 0.14
  else if (printerAvailabilityPercent < 75) confidence -= 0.07
  if (materialAvailability === 'unknown') confidence -= 0.08
  if (materialAvailability === 'limited') confidence -= 0.09
  if (materialAvailability === 'out_of_stock') confidence -= 0.2
  confidence = clamp(confidence, 0.25, 0.97)

  const spread = 0.12 + (1 - confidence) * 0.45
  const minHours = round1(Math.max(0.25, hours * (1 - spread)))
  const maxHours = round1(Math.max(minHours + 0.1, hours * (1 + spread)))

  return {
    hours,
    minHours,
    maxHours,
    confidenceScore: round1(confidence),
    signals: {
      baseHours: round1(baseHours),
      queueHours: round1(queueHours),
      queueDelayHours: round1(queueDelayHours),
      capacityHoursPerDay: round1(capacityHoursPerDay),
      printerAvailabilityPercent: round1(printerAvailabilityPercent),
      materialAvailability,
    },
  }
}
