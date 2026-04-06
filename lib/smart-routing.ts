export type SmartRoutingPolicy = {
  prioritizeSpeed: number
  prioritizeCost: number
  prioritizeQueueBalance: number
  prioritizeSla: number
  requireMaterialCompatibility: boolean
  restrictToPrintLabPrinters: boolean
}

export type SmartRoutingPrinter = {
  id: string
  name: string
  provider?: string | null
  status: string
  active: boolean
  dailyCapacityHours: number
  metadata?: unknown
}

export type SmartRoutingOrder = {
  id: string
  createdAt: Date
  totalHours: number
  printerId?: string | null
  materials: string[]
  queuePosition?: number | null
}

export type SmartRoutingRecommendation = {
  orderId: string
  printerId: string
  printerName: string
  score: number
  reasons: string[]
}

type PrinterCapabilities = {
  supportedMaterials: string[]
  costPerHour: number | null
  throughputMultiplier: number
}

export const DEFAULT_SMART_ROUTING_POLICY: SmartRoutingPolicy = {
  prioritizeSpeed: 0.4,
  prioritizeCost: 0.15,
  prioritizeQueueBalance: 0.25,
  prioritizeSla: 0.2,
  requireMaterialCompatibility: true,
  restrictToPrintLabPrinters: false,
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeTextList(input: unknown) {
  if (!Array.isArray(input)) return []
  return input
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function getPrinterCapabilities(printer: SmartRoutingPrinter): PrinterCapabilities {
  const metadata = asRecord(printer.metadata)
  const throughputMultiplierRaw = Number(metadata?.throughputMultiplier ?? 1)
  const costPerHourRaw = Number(metadata?.costPerHour ?? metadata?.costUsdPerHour ?? NaN)
  return {
    supportedMaterials: normalizeTextList(metadata?.supportedMaterials),
    costPerHour: Number.isFinite(costPerHourRaw) && costPerHourRaw >= 0 ? costPerHourRaw : null,
    throughputMultiplier: Number.isFinite(throughputMultiplierRaw) && throughputMultiplierRaw > 0
      ? throughputMultiplierRaw
      : 1,
  }
}

function isPrinterEligible(printer: SmartRoutingPrinter, policy: SmartRoutingPolicy) {
  if (!printer.active) return false
  if (printer.status === 'maintenance' || printer.status === 'offline' || printer.status === 'printing') return false
  if (policy.restrictToPrintLabPrinters && !['printlab', 'bambu-view'].includes(String(printer.provider || '').toLowerCase())) {
    return false
  }
  return true
}

function normalizePolicy(input?: Partial<SmartRoutingPolicy> | null): SmartRoutingPolicy {
  return {
    prioritizeSpeed: clamp(Number(input?.prioritizeSpeed ?? DEFAULT_SMART_ROUTING_POLICY.prioritizeSpeed), 0, 1),
    prioritizeCost: clamp(Number(input?.prioritizeCost ?? DEFAULT_SMART_ROUTING_POLICY.prioritizeCost), 0, 1),
    prioritizeQueueBalance: clamp(Number(input?.prioritizeQueueBalance ?? DEFAULT_SMART_ROUTING_POLICY.prioritizeQueueBalance), 0, 1),
    prioritizeSla: clamp(Number(input?.prioritizeSla ?? DEFAULT_SMART_ROUTING_POLICY.prioritizeSla), 0, 1),
    requireMaterialCompatibility: input?.requireMaterialCompatibility ?? DEFAULT_SMART_ROUTING_POLICY.requireMaterialCompatibility,
    restrictToPrintLabPrinters: input?.restrictToPrintLabPrinters ?? DEFAULT_SMART_ROUTING_POLICY.restrictToPrintLabPrinters,
  }
}

function getAssignedHoursByPrinter(printers: SmartRoutingPrinter[], orders: SmartRoutingOrder[]) {
  const totals = new Map<string, number>(printers.map((printer) => [printer.id, 0]))
  for (const order of orders) {
    if (!order.printerId) continue
    totals.set(order.printerId, (totals.get(order.printerId) || 0) + Math.max(0, order.totalHours || 0))
  }
  return totals
}

function getOrderAgeHours(order: SmartRoutingOrder) {
  return Math.max(0, (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60))
}

export function recommendSmartRouting(args: {
  printers: SmartRoutingPrinter[]
  orders: SmartRoutingOrder[]
  policy?: Partial<SmartRoutingPolicy> | null
}) {
  const policy = normalizePolicy(args.policy)
  const eligiblePrinters = args.printers.filter((printer) => isPrinterEligible(printer, policy))
  const assignedHours = getAssignedHoursByPrinter(eligiblePrinters, args.orders)
  const recommendations: SmartRoutingRecommendation[] = []
  const pendingOrders = args.orders
    .filter((order) => !order.printerId)
    .sort((a, b) => {
      const queueA = typeof a.queuePosition === 'number' ? a.queuePosition : Number.MAX_SAFE_INTEGER
      const queueB = typeof b.queuePosition === 'number' ? b.queuePosition : Number.MAX_SAFE_INTEGER
      if (queueA !== queueB) return queueA - queueB
      return a.createdAt.getTime() - b.createdAt.getTime()
    })

  for (const order of pendingOrders) {
    const orderMaterials = Array.from(new Set(order.materials.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean)))
    const scored = eligiblePrinters
      .map((printer) => {
        const capabilities = getPrinterCapabilities(printer)
        const materialCompatible = orderMaterials.length === 0
          || capabilities.supportedMaterials.length === 0
          || orderMaterials.every((material) => capabilities.supportedMaterials.includes(material))
        if (policy.requireMaterialCompatibility && !materialCompatible) return null

        const currentLoad = assignedHours.get(printer.id) || 0
        const normalizedCapacity = printer.dailyCapacityHours > 0
          ? clamp(1 - (currentLoad / Math.max(printer.dailyCapacityHours, 1)), 0, 1)
          : 0
        const throughputScore = clamp(capabilities.throughputMultiplier / 2, 0, 1)
        const speedScore = clamp((throughputScore * 0.7) + (normalizedCapacity * 0.3), 0, 1)
        const costScore = capabilities.costPerHour == null
          ? 0.5
          : clamp(1 - (capabilities.costPerHour / 10), 0, 1)
        const balanceScore = normalizedCapacity
        const slaUrgency = clamp(getOrderAgeHours(order) / 24, 0, 1)
        const slaScore = clamp((slaUrgency * 0.6) + (speedScore * 0.4), 0, 1)
        const totalScore =
          speedScore * policy.prioritizeSpeed +
          costScore * policy.prioritizeCost +
          balanceScore * policy.prioritizeQueueBalance +
          slaScore * policy.prioritizeSla +
          (materialCompatible ? 0.05 : 0)

        const reasons = [
          `speed ${speedScore.toFixed(2)}`,
          `queue headroom ${balanceScore.toFixed(2)}`,
          `sla ${slaScore.toFixed(2)}`,
        ]
        if (capabilities.costPerHour != null) {
          reasons.push(`cost ${capabilities.costPerHour.toFixed(2)}/hr`)
        }
        if (capabilities.supportedMaterials.length > 0 && orderMaterials.length > 0) {
          reasons.push(`materials ${orderMaterials.join(', ')}`)
        }

        return {
          orderId: order.id,
          printerId: printer.id,
          printerName: printer.name,
          score: Number(totalScore.toFixed(4)),
          reasons,
        } satisfies SmartRoutingRecommendation
      })
      .filter((entry): entry is SmartRoutingRecommendation => Boolean(entry))
      .sort((a, b) => b.score - a.score || a.printerName.localeCompare(b.printerName))

    const winner = scored[0]
    if (!winner) continue
    recommendations.push(winner)
    assignedHours.set(winner.printerId, (assignedHours.get(winner.printerId) || 0) + Math.max(0, order.totalHours || 0))
  }

  return {
    policy,
    recommendations,
  }
}
