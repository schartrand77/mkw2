import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { normalizeMaterialName, resolveScaleFromDimensions } from '@/lib/cartPricing'
import { buildManufacturabilitySnapshot, renderManufacturabilityReportPdf, type ManufacturabilityModelInput } from '@/lib/manufacturability-report'
import type { CheckoutLineItem } from '@/types/checkout'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

const dimensionSchema = z.object({
  x: z.number().positive().max(5000).optional(),
  y: z.number().positive().max(5000).optional(),
  z: z.number().positive().max(5000).optional(),
}).partial()

const payloadSchema = z.object({
  material: z.string().max(40).optional(),
  colors: z.array(z.string().max(64)).optional(),
  finish: z.string().max(40).optional(),
  infillPct: z.number().int().min(0).max(100).optional().nullable(),
  qty: z.number().int().min(1).max(50).optional(),
  scale: z.number().positive().max(5).optional(),
  scaleX: z.number().positive().max(5).optional(),
  scaleY: z.number().positive().max(5).optional(),
  scaleZ: z.number().positive().max(5).optional(),
  targetDimensions: dimensionSchema.optional(),
})

export async function POST(req: NextRequest, { params }: Context) {
  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid manufacturability payload' }, { status: 400 })
  }

  const model = await prisma.model.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      material: true,
      sizeXmm: true,
      sizeYmm: true,
      sizeZmm: true,
      printabilityScore: true,
      failureRiskScore: true,
      orientationSuggestion: true,
      supportLikelihood: true,
    },
  })

  if (!model) return NextResponse.json({ error: 'Model not found' }, { status: 404 })

  const material = normalizeMaterialName(parsed.data.material || model.material || 'PLA')
  const { scaleX, scaleY, scaleZ, uniformScale } = resolveScaleFromDimensions({
    size: { x: model.sizeXmm ?? null, y: model.sizeYmm ?? null, z: model.sizeZmm ?? null },
    target: parsed.data.targetDimensions ?? null,
    scale: parsed.data.scale ?? 1,
    scaleX: parsed.data.scaleX ?? null,
    scaleY: parsed.data.scaleY ?? null,
    scaleZ: parsed.data.scaleZ ?? null,
  })

  const lineItem: CheckoutLineItem = {
    modelId: model.id,
    title: model.title,
    qty: parsed.data.qty ?? 1,
    scale: uniformScale,
    scaleX,
    scaleY,
    scaleZ,
    unitPrice: 0,
    lineTotal: 0,
    material,
    colors: parsed.data.colors || [],
    finish: parsed.data.finish || undefined,
    infillPct: parsed.data.infillPct ?? undefined,
    targetDimensions: parsed.data.targetDimensions || undefined,
  }

  const modelsById = new Map<string, ManufacturabilityModelInput>([
    [
      model.id,
      {
        id: model.id,
        title: model.title,
        material: model.material,
        sizeXmm: model.sizeXmm,
        sizeYmm: model.sizeYmm,
        sizeZmm: model.sizeZmm,
        printabilityScore: model.printabilityScore,
        failureRiskScore: model.failureRiskScore,
        orientationSuggestion: model.orientationSuggestion,
        supportLikelihood: model.supportLikelihood,
      },
    ],
  ])

  const snapshot = buildManufacturabilitySnapshot({ lineItems: [lineItem], modelsById })
  const pdf = renderManufacturabilityReportPdf(snapshot, model.title)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="manufacturability-${model.id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
