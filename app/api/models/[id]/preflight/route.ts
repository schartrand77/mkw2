import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { normalizeMaterialName, resolveScaleFromDimensions } from '@/lib/cartPricing'
import { buildPreflightAssistant } from '@/lib/preflight-assistant'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

const dimensionSchema = z.object({
  x: z.number().positive().max(5000).optional(),
  y: z.number().positive().max(5000).optional(),
  z: z.number().positive().max(5000).optional(),
}).partial()

const payloadSchema = z.object({
  material: z.string().max(40).optional(),
  finish: z.string().max(40).optional(),
  toleranceClass: z.enum(['draft', 'standard', 'cosmetic', 'fit_critical']).optional(),
  scale: z.number().positive().max(5).optional(),
  scaleX: z.number().positive().max(5).optional(),
  scaleY: z.number().positive().max(5).optional(),
  scaleZ: z.number().positive().max(5).optional(),
  targetDimensions: dimensionSchema.optional(),
  leadTimeHours: z.number().nonnegative().optional(),
  etaConfidenceScore: z.number().min(0).max(1).optional(),
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
    return NextResponse.json({ error: 'Invalid preflight payload' }, { status: 400 })
  }

  const model = await prisma.model.findUnique({
    where: { id },
    select: {
      id: true,
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

  const assistant = buildPreflightAssistant({
    material,
    finish: parsed.data.finish ?? null,
    toleranceClass: parsed.data.toleranceClass ?? 'standard',
    printabilityScore: model.printabilityScore,
    failureRiskScore: model.failureRiskScore,
    supportLikelihood: model.supportLikelihood,
    orientationSuggestion: model.orientationSuggestion,
    leadTimeHours: parsed.data.leadTimeHours ?? null,
    etaConfidenceScore: parsed.data.etaConfidenceScore ?? null,
    sizeXmm: model.sizeXmm ? model.sizeXmm * scaleX : null,
    sizeYmm: model.sizeYmm ? model.sizeYmm * scaleY : null,
    sizeZmm: model.sizeZmm ? model.sizeZmm * scaleZ : null,
    scale: uniformScale,
    targetDimensions: parsed.data.targetDimensions ?? null,
  })

  return NextResponse.json({ preflight: assistant })
}
