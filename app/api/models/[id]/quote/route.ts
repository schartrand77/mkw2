import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getColorMultiplier, normalizeColors, normalizeMaterialName, resolveScaleFromDimensions } from '@/lib/cartPricing'
import { buildAllowedColorTokenSet, isColorAllowed, normalizeModelColorSlotCount } from '@/lib/color-constraints'
import { estimatePricingDetails } from '@/lib/pricing'
import { applyPricingAdjustments, getPricingAdjustmentConfig, resolveBatchDiscountPercent } from '@/lib/estimate-adjustments'

export const dynamic = 'force-dynamic'

type QuoteContext = { params: Promise<{ id: string }> }

const dimensionSchema = z.object({
  x: z.number().positive().max(5000).optional(),
  y: z.number().positive().max(5000).optional(),
  z: z.number().positive().max(5000).optional(),
}).partial()

const bodySchema = z.object({
  material: z.string().max(40).optional(),
  colors: z.array(z.string().max(64)).optional(),
  finish: z.string().max(40).optional(),
  infillPct: z.number().int().min(0).max(100).optional().nullable(),
  qty: z.number().int().min(1).max(50).optional(),
  rush: z.boolean().optional(),
  scale: z.number().positive().max(5).optional(),
  scaleX: z.number().positive().max(5).optional(),
  scaleY: z.number().positive().max(5).optional(),
  scaleZ: z.number().positive().max(5).optional(),
  targetDimensions: dimensionSchema.optional(),
})

const DEFAULT_INFILL_PCT = 20

export async function POST(req: NextRequest, { params }: QuoteContext) {
  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid quote payload' }, { status: 400 })
  }

  const model = await prisma.model.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      material: true,
      volumeMm3: true,
      sizeXmm: true,
      sizeYmm: true,
      sizeZmm: true,
      salePriceUsd: true,
      flatRatePricing: true,
      supportRatio: true,
      colorSlotCount: true,
      allowedColors: true,
    },
  })
  if (!model) return NextResponse.json({ error: 'Model not found' }, { status: 404 })
  let volumeMm3 = model.volumeMm3
  let supportRatio = model.supportRatio
  let partsForSupport: Array<{ volumeMm3: number | null; supportRatio: number | null }> | null = null
  if (volumeMm3 == null || !Number.isFinite(Number(volumeMm3)) || Number(volumeMm3) <= 0) {
    const parts = await prisma.modelPart.findMany({
      where: { modelId: id },
      select: { volumeMm3: true, supportRatio: true },
    })
    partsForSupport = parts
    if (parts.length > 0 && parts.every((part) => part.volumeMm3 != null && Number.isFinite(Number(part.volumeMm3)))) {
      volumeMm3 = parts.reduce((sum, part) => sum + Number(part.volumeMm3 || 0), 0)
    }
    if (supportRatio == null || !Number.isFinite(Number(supportRatio))) {
      let weightedSupport = 0
      let weightedVolume = 0
      for (const part of parts) {
        if (part.volumeMm3 == null || !Number.isFinite(Number(part.volumeMm3))) continue
        if (part.supportRatio == null || !Number.isFinite(Number(part.supportRatio))) continue
        const vol = Number(part.volumeMm3)
        weightedSupport += Number(part.supportRatio) * vol
        weightedVolume += vol
      }
      if (weightedVolume > 0) {
        supportRatio = weightedSupport / weightedVolume
      }
    }
  }
  if (volumeMm3 == null || !Number.isFinite(Number(volumeMm3)) || Number(volumeMm3) <= 0) {
    return NextResponse.json({ pending: true, error: 'Model volume is pending' })
  }
  if (supportRatio == null || !Number.isFinite(Number(supportRatio))) {
    const parts = partsForSupport ?? await prisma.modelPart.findMany({
      where: { modelId: id },
      select: { volumeMm3: true, supportRatio: true },
    })
    let weightedSupport = 0
    let weightedVolume = 0
    for (const part of parts) {
      if (part.volumeMm3 == null || !Number.isFinite(Number(part.volumeMm3))) continue
      if (part.supportRatio == null || !Number.isFinite(Number(part.supportRatio))) continue
      const vol = Number(part.volumeMm3)
      weightedSupport += Number(part.supportRatio) * vol
      weightedVolume += vol
    }
    if (weightedVolume > 0) {
      supportRatio = weightedSupport / weightedVolume
    }
  }

  const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' } })
  const material = normalizeMaterialName(parsed.data.material || model.material || 'PLA')
  const colorSlotCount = normalizeModelColorSlotCount(model.colorSlotCount)
  const allowedColors = Array.isArray(model.allowedColors)
    ? model.allowedColors.map((value) => String(value || '')).filter((value) => value.trim().length > 0)
    : null
  const allowedTokens = buildAllowedColorTokenSet(allowedColors)
  const rawColors = Array.isArray(parsed.data.colors)
    ? parsed.data.colors.map((value) => String(value || '').trim()).filter(Boolean)
    : []
  const slotLimit = colorSlotCount ?? undefined
  if (slotLimit != null && rawColors.length > slotLimit) {
    return NextResponse.json({ error: `This model allows up to ${slotLimit} color slots.` }, { status: 400 })
  }
  const colors = normalizeColors(rawColors, slotLimit ?? undefined)
  if (allowedTokens && colors.some((color) => !isColorAllowed(color, allowedTokens))) {
    return NextResponse.json({ error: 'One or more selected colors are not allowed for this model.' }, { status: 400 })
  }
  const finish = parsed.data.finish ? String(parsed.data.finish) : null
  const infillPct = parsed.data.infillPct ?? null
  const qty = parsed.data.qty ?? 1
  const rush = Boolean(parsed.data.rush)
  const colorCountForPricing = model.flatRatePricing ? 1 : colors.length

  const { scaleX, scaleY, scaleZ, uniformScale } = resolveScaleFromDimensions({
    size: { x: model.sizeXmm ?? null, y: model.sizeYmm ?? null, z: model.sizeZmm ?? null },
    target: parsed.data.targetDimensions ?? null,
    scale: parsed.data.scale ?? 1,
    scaleX: parsed.data.scaleX ?? null,
    scaleY: parsed.data.scaleY ?? null,
    scaleZ: parsed.data.scaleZ ?? null,
  })
  const volumeMultiplier = scaleX * scaleY * scaleZ
  const cm3 = Number(volumeMm3) / 1000 * volumeMultiplier

  const pricing = estimatePricingDetails({
    cm3,
    material,
    infillPct,
    finish,
    supportRatio: supportRatio ?? null,
    colorCount: colorCountForPricing,
    cfg,
    applyMinimum: true,
  })
  const colorMultiplier = model.flatRatePricing ? 1 : getColorMultiplier(colors)
  let basePrice = Number((pricing.price * colorMultiplier).toFixed(2))

  if (model.salePriceUsd != null && Number.isFinite(Number(model.salePriceUsd)) && Number(model.salePriceUsd) > 0) {
    const baseMaterial = normalizeMaterialName(model.material || 'PLA')
    const basePricing = estimatePricingDetails({
      cm3: Number(volumeMm3) / 1000,
      material: baseMaterial,
      infillPct: DEFAULT_INFILL_PCT,
      finish: 'standard',
      supportRatio: supportRatio ?? null,
      colorCount: 1,
      cfg,
      applyMinimum: true,
    })
    if (basePricing.price > 0) {
      basePrice = Number(((pricing.price * colorMultiplier * Number(model.salePriceUsd)) / basePricing.price).toFixed(2))
    } else {
      basePrice = Number(model.salePriceUsd)
    }
  }

  const adjustments = getPricingAdjustmentConfig(cfg || undefined)
  const batchDiscountPercent = resolveBatchDiscountPercent(qty, adjustments.batchDiscountTiers)
  const adjusted = applyPricingAdjustments({
    unitPrice: basePrice,
    qty,
    rush,
    demandSurgeMultiplier: adjustments.demandSurgeMultiplier,
    rushMultiplier: adjustments.rushMultiplier,
    batchDiscountPercent,
  })
  const priceUsd = adjusted.adjustedUnitPrice

  const targetDimensions = (() => {
    const dims: Record<string, number> = {}
    if (typeof model.sizeXmm === 'number' && Number.isFinite(model.sizeXmm)) {
      dims.x = Number((model.sizeXmm * scaleX).toFixed(1))
    }
    if (typeof model.sizeYmm === 'number' && Number.isFinite(model.sizeYmm)) {
      dims.y = Number((model.sizeYmm * scaleY).toFixed(1))
    }
    if (typeof model.sizeZmm === 'number' && Number.isFinite(model.sizeZmm)) {
      dims.z = Number((model.sizeZmm * scaleZ).toFixed(1))
    }
    return Object.keys(dims).length ? dims : null
  })()

  return NextResponse.json({
    quote: {
      modelId: model.id,
      material,
      colors,
      finish,
      infillPct,
      scale: uniformScale,
      scaleX,
      scaleY,
      scaleZ,
      targetDimensions,
      priceUsd,
      leadTimeHours: pricing.hours,
      pricing,
      adjustments: {
        batchDiscountPercent,
        rush,
        demandSurgeMultiplier: adjustments.demandSurgeMultiplier,
        rushMultiplier: adjustments.rushMultiplier,
      },
    },
  })
}
