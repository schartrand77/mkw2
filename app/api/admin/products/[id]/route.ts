import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { syncProductTemplateToStockworks } from '@/lib/stockworks-products'
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
  lockedMaterial: z.string().min(1).max(40).optional().nullable(),
  lockedColor: z.string().max(80).optional().nullable(),
  lockedColorCount: z.number().int().min(1).max(16).optional().nullable(),
  lockedScale: z.number().positive().max(5).optional().nullable(),
  lockedFinish: z.string().max(40).optional().nullable(),
  lockedPriceMultiplier: z.number().positive().max(5).optional().nullable(),
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
    if (parsed.baseModelId) {
      const baseModel = await prisma.model.findUnique({
        where: { id: parsed.baseModelId },
        select: { id: true },
      })
      if (!baseModel) {
        return NextResponse.json({ error: 'Base model not found.' }, { status: 400 })
      }
    }
    const updated = await prisma.productTemplate.update({
      where: { id },
      data: {
        title: parsed.title ?? undefined,
        description: parsed.description === null ? null : parsed.description || undefined,
        baseModelId: parsed.baseModelId === null ? null : parsed.baseModelId || undefined,
        lockedMaterial: parsed.lockedMaterial === null ? null : parsed.lockedMaterial || undefined,
        lockedColor: parsed.lockedColor === null ? null : parsed.lockedColor || undefined,
        lockedColorCount: parsed.lockedColorCount ?? undefined,
        lockedScale: parsed.lockedScale ?? undefined,
        lockedFinish: parsed.lockedFinish === null ? null : parsed.lockedFinish || undefined,
        lockedPriceMultiplier: parsed.lockedPriceMultiplier ?? undefined,
        materialOptions: parsed.materialOptions ?? undefined,
        colorOptions: parsed.colorOptions ?? undefined,
        sizeOptions: parsed.sizeOptions ?? undefined,
        isActive: parsed.isActive ?? undefined,
      },
    })
    let product = updated
    let stockworksWarning: string | null = null
    try {
      const synced = await syncProductTemplateToStockworks({
        title: updated.title,
        material: updated.lockedMaterial,
        color: updated.lockedColor,
        stockworksMaterialId: updated.stockworksMaterialId,
        stockworksInventoryItemId: updated.stockworksInventoryItemId,
      })
      product = await prisma.productTemplate.update({
        where: { id: updated.id },
        data: {
          stockworksMaterialId: synced.materialId ?? null,
          stockworksInventoryItemId: synced.inventoryItemId ?? null,
        },
      })
    } catch (err: any) {
      stockworksWarning = err?.message || 'StockWorks sync failed'
    }
    const hydrated = await prisma.productTemplate.findUnique({
      where: { id: product.id },
      include: { baseModel: { select: { id: true, title: true } } },
    })
    return NextResponse.json({ product: hydrated || product, stockworksWarning })
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
