import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
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
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  baseModelId: z.string().cuid().optional().nullable(),
  materialOptions: z.array(optionSchema).optional().nullable(),
  colorOptions: z.array(optionSchema).optional().nullable(),
  sizeOptions: z.array(optionSchema).optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const products = await prisma.productTemplate.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { baseModel: { select: { id: true, title: true } } },
  })
  return NextResponse.json({ products })
}

export async function POST(req: Request) {
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const json = await req.json()
    const parsed = schema.parse(json)
    const created = await prisma.productTemplate.create({
      data: {
        title: parsed.title,
        description: parsed.description || undefined,
        baseModelId: parsed.baseModelId || undefined,
        materialOptions: parsed.materialOptions || undefined,
        colorOptions: parsed.colorOptions || undefined,
        sizeOptions: parsed.sizeOptions || undefined,
        isActive: parsed.isActive ?? true,
      },
    })
    return NextResponse.json({ product: created, adminId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
