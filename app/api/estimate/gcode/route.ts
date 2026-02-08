import { NextRequest, NextResponse } from 'next/server'
import { estimateFromGcode } from '@/lib/gcode'
import { estimatePricingDetails } from '@/lib/pricing'
import { normalizeMaterialName } from '@/lib/cartPricing'
import { applyPricingAdjustments, getPricingAdjustmentConfig, resolveBatchDiscountPercent } from '@/lib/estimate-adjustments'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = (form.get('file') || form.get('gcode')) as File | null
    if (!file) {
      return NextResponse.json({ error: 'Missing G-code file.' }, { status: 400 })
    }
    const material = normalizeMaterialName(String(form.get('material') || 'PLA'))
    const qty = Number(form.get('qty') || 1)
    const rush = String(form.get('rush') || '') === 'true'
    const toolMaterialsRaw = String(form.get('toolMaterials') || '')
    const toolMaterials = toolMaterialsRaw ? safeParseJson(toolMaterialsRaw) : null

    const buf = Buffer.from(await file.arrayBuffer())
    const text = buf.toString('utf8')
    const estimate = estimateFromGcode(text)
    if (!estimate.cm3 || !Number.isFinite(estimate.cm3)) {
      return NextResponse.json({ error: 'Unable to parse filament usage from G-code.' }, { status: 400 })
    }

    const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' } })
    const pricing = estimatePricingDetails({
      cm3: estimate.cm3,
      material,
      cfg,
      applyMinimum: true,
    })
    const adjustments = getPricingAdjustmentConfig(cfg || undefined)
    const batchDiscountPercent = resolveBatchDiscountPercent(Number.isFinite(qty) ? qty : 1, adjustments.batchDiscountTiers)
    const adjusted = applyPricingAdjustments({
      unitPrice: pricing.price,
      qty: Number.isFinite(qty) ? qty : 1,
      rush,
      demandSurgeMultiplier: adjustments.demandSurgeMultiplier,
      rushMultiplier: adjustments.rushMultiplier,
      batchDiscountPercent,
    })

    const materialBreakdown = buildMaterialBreakdown(estimate, toolMaterials)

    return NextResponse.json({
      estimate: {
        material,
        cm3: estimate.cm3,
        estimatedSeconds: estimate.estimatedSeconds,
        filamentMm: estimate.filamentMm,
        filamentGrams: estimate.filamentGrams,
        filamentByToolMm: estimate.filamentByToolMm,
        filamentByToolGrams: estimate.filamentByToolGrams,
        materialBreakdown,
        priceUsd: adjusted.adjustedUnitPrice,
        pricing,
        adjustments: {
          batchDiscountPercent,
          rush,
          demandSurgeMultiplier: adjustments.demandSurgeMultiplier,
          rushMultiplier: adjustments.rushMultiplier,
        },
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to parse G-code.' }, { status: 500 })
  }
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function buildMaterialBreakdown(estimate: ReturnType<typeof estimateFromGcode>, toolMaterials: any) {
  if (!Array.isArray(estimate.filamentByToolMm) || estimate.filamentByToolMm.length === 0) return null
  const materials = Array.isArray(toolMaterials) ? toolMaterials.map((m) => normalizeMaterialName(String(m || ''))) : []
  const breakdownMap = new Map<string, { filamentMm: number }>()
  estimate.filamentByToolMm.forEach((mm, idx) => {
    const key = materials[idx] || `Tool ${idx + 1}`
    const entry = breakdownMap.get(key) || { filamentMm: 0 }
    entry.filamentMm += mm
    breakdownMap.set(key, entry)
  })
  return Array.from(breakdownMap.entries()).map(([material, entry]) => ({
    material,
    filamentMm: Number(entry.filamentMm.toFixed(1)),
  }))
}
