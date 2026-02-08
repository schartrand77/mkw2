import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const optionSchema = z.object({
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(40).optional(),
  scale: z.number().positive().max(5).optional(),
  colorCount: z.number().int().min(1).max(16).optional(),
  priceMultiplier: z.number().positive().max(5).optional(),
})

const schema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  baseModelId: z.string().cuid().optional().nullable(),
  materialOptions: z.array(optionSchema).optional().nullable(),
  colorOptions: z.array(optionSchema).optional().nullable(),
  sizeOptions: z.array(optionSchema).optional().nullable(),
  isActive: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteContext) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const { id } = await params
  const product = await prisma.productTemplate.findUnique({
    where: { id },
    include: { baseModel: { select: { id: true, title: true } } },
  })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ product })
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const { id } = await params
  try {
    const json = await req.json()
    const parsed = schema.parse(json)
    const updated = await prisma.productTemplate.update({
      where: { id },
      data: {
        title: parsed.title ?? undefined,
        description: parsed.description === null ? null : parsed.description || undefined,
        baseModelId: parsed.baseModelId === null ? null : parsed.baseModelId || undefined,
        materialOptions: parsed.materialOptions ?? undefined,
        colorOptions: parsed.colorOptions ?? undefined,
        sizeOptions: parsed.sizeOptions ?? undefined,
        isActive: parsed.isActive ?? undefined,
      },
    })
    return NextResponse.json({ product: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const { id } = await params
  try {
    await prisma.productTemplate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete' }, { status: 400 })
  }
}
