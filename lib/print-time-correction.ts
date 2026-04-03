import { prisma } from '@/lib/db'
import { estimatePricingDetails } from '@/lib/pricing'
import type { SiteConfig } from '@prisma/client'

type OrderItemLite = {
  modelId?: string | null
  partId?: string | null
  material?: string | null
  infillPct?: number | null
  finish?: string | null
  quantity?: number | null
}

type VolumeMaps = {
  modelVolumes: Map<string, number | null>
  partVolumes: Map<string, number | null>
}

function normalizeMetadata(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return { ...(raw as Record<string, any>) }
}

function extractPrintHours(metadata: unknown): number | null {
  const meta = normalizeMetadata(metadata)
  const slicer = meta.slicerStats
  if (!slicer || typeof slicer !== 'object' || Array.isArray(slicer)) return null
  const raw = (slicer as any).printHours
  const numeric = Number(raw)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return numeric
}

async function loadVolumeMaps(items: OrderItemLite[]): Promise<VolumeMaps> {
  const modelIds = Array.from(new Set(items.map((item) => item.modelId).filter((id): id is string => Boolean(id))))
  const partIds = Array.from(new Set(items.map((item) => item.partId).filter((id): id is string => Boolean(id))))
  const [models, parts] = await Promise.all([
    modelIds.length
      ? prisma.model.findMany({ where: { id: { in: modelIds } }, select: { id: true, volumeMm3: true } })
      : Promise.resolve([]),
    partIds.length
      ? prisma.modelPart.findMany({ where: { id: { in: partIds } }, select: { id: true, volumeMm3: true } })
      : Promise.resolve([]),
  ])
  return {
    modelVolumes: new Map(models.map((model) => [model.id, model.volumeMm3 ?? null])),
    partVolumes: new Map(parts.map((part) => [part.id, part.volumeMm3 ?? null])),
  }
}

function estimateOrderHours(items: OrderItemLite[], volumes: VolumeMaps, cfg?: Partial<SiteConfig> | null): number {
  return items.reduce((sum, item) => {
    const partVolume = item.partId ? volumes.partVolumes.get(item.partId) : null
    const modelVolume = item.modelId ? volumes.modelVolumes.get(item.modelId) : null
    const volumeMm3 = partVolume ?? modelVolume ?? null
    if (!volumeMm3 || !Number.isFinite(volumeMm3)) return sum
    const cm3 = volumeMm3 / 1000
    const details = estimatePricingDetails({
      cm3,
      material: item.material ?? undefined,
      infillPct: item.infillPct ?? undefined,
      finish: item.finish ?? undefined,
      cfg,
      applyMinimum: false,
    })
    const qty = typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? Math.max(1, item.quantity) : 1
    return sum + details.hours * qty
  }, 0)
}

export async function computePrintTimeCorrection(options?: { days?: number; sampleLimit?: number }) {
  const days = options?.days ?? 90
  const sampleLimit = options?.sampleLimit ?? 200
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' } })
  const orders = await prisma.printOrder.findMany({
    where: { createdAt: { gte: since } },
    take: sampleLimit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      metadata: true,
      items: {
        select: {
          modelId: true,
          partId: true,
          material: true,
          infillPct: true,
          finish: true,
          quantity: true,
        },
      },
    },
  })

  const items = orders.flatMap((order) => order.items)
  const volumeMaps = await loadVolumeMaps(items)

  let totalEstimated = 0
  let totalActual = 0
  let sampleCount = 0

  const cfgWithoutCorrection = cfg ? { ...cfg, printTimeCorrectionFactor: 1 } : undefined

  for (const order of orders) {
    const actualHours = extractPrintHours(order.metadata)
    if (!actualHours) continue
    const estimatedHours = estimateOrderHours(order.items as OrderItemLite[], volumeMaps, cfgWithoutCorrection)
    if (!Number.isFinite(estimatedHours) || estimatedHours <= 0) continue
    totalEstimated += estimatedHours
    totalActual += actualHours
    sampleCount += 1
  }

  const ratio = totalEstimated > 0 ? totalActual / totalEstimated : 1
  const suggested = Number.isFinite(ratio) ? Math.max(0.5, Math.min(2.5, ratio)) : 1

  return {
    suggestedFactor: Number(suggested.toFixed(3)),
    totalActualHours: Number(totalActual.toFixed(2)),
    totalEstimatedHours: Number(totalEstimated.toFixed(2)),
    samples: sampleCount,
    rangeDays: days,
  }
}
