import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import {
  syncProductTemplateToStockworks,
  syncStockworksModelsToProductTemplates,
  unlinkProductTemplateFromStockworks,
} from '@/lib/stockworks-products'
import { buildLockedTemplateOptions } from '@/lib/product-template-config'
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
  try { await syncStockworksModelsToProductTemplates() } catch {}
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
    const existing = await prisma.productTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        lockedMaterial: true,
        lockedColor: true,
        lockedColorCount: true,
        lockedScale: true,
        lockedFinish: true,
        lockedPriceMultiplier: true,
        stockworksMaterialId: true,
        stockworksInventoryItemId: true,
      },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const nextTitle = parsed.title?.trim() || existing.title
    const nextLockedMaterial = parsed.lockedMaterial === null
      ? null
      : (parsed.lockedMaterial || existing.lockedMaterial)
    const nextLockedColor = parsed.lockedColor === null
      ? null
      : (parsed.lockedColor || existing.lockedColor)
    const nextLockedColorCount = parsed.lockedColorCount ?? existing.lockedColorCount
    const nextLockedScale = parsed.lockedScale ?? existing.lockedScale
    const nextLockedFinish = parsed.lockedFinish === null
      ? null
      : (parsed.lockedFinish || existing.lockedFinish)
    const nextLockedPriceMultiplier = parsed.lockedPriceMultiplier ?? existing.lockedPriceMultiplier
    const locked = buildLockedTemplateOptions({
      material: nextLockedMaterial,
      color: nextLockedColor,
      colorCount: nextLockedColorCount,
      scale: nextLockedScale,
      finish: nextLockedFinish,
      priceMultiplier: nextLockedPriceMultiplier,
    })
    let stockworksMaterialIdPatch: number | null | undefined = undefined
    let stockworksInventoryItemIdPatch: number | null | undefined = undefined
    let stockworksWarning: string | null = null

    try {
      const synced = await syncProductTemplateToStockworks({
        title: nextTitle,
        material: nextLockedMaterial,
        color: nextLockedColor,
        stockworksMaterialId: existing.stockworksMaterialId,
        stockworksInventoryItemId: existing.stockworksInventoryItemId,
      })
      stockworksMaterialIdPatch = synced.materialId ?? null
      stockworksInventoryItemIdPatch = synced.inventoryItemId ?? null
    } catch (err: any) {
      stockworksWarning = err?.message || 'Failed to sync product with StockWorks inventory models.'
    }

    const product = await prisma.productTemplate.update({
      where: { id },
      data: {
        title: parsed.title ?? undefined,
        description: parsed.description === null ? null : parsed.description || undefined,
        baseModelId: parsed.baseModelId === null ? null : parsed.baseModelId || undefined,
        lockedMaterial: locked.material,
        lockedColor: locked.color,
        lockedColorCount: locked.colorCount,
        lockedScale: locked.scale,
        lockedFinish: locked.finish,
        lockedPriceMultiplier: locked.priceMultiplier,
        materialOptions: parsed.materialOptions ?? locked.materialOptions,
        colorOptions: parsed.colorOptions ?? locked.colorOptions,
        sizeOptions: parsed.sizeOptions ?? locked.sizeOptions,
        isActive: parsed.isActive ?? undefined,
        stockworksMaterialId: stockworksMaterialIdPatch,
        stockworksInventoryItemId: stockworksInventoryItemIdPatch,
      },
    })
    const hydrated = await prisma.productTemplate.findUnique({
      where: { id: product.id },
      include: { baseModel: { select: { id: true, title: true } } },
    })
    return NextResponse.json({ product: hydrated || product, stockworksWarning })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to save product' }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const { id } = await params
  try {
    const existing = await prisma.productTemplate.findUnique({
      where: { id },
      select: { stockworksMaterialId: true, stockworksInventoryItemId: true },
    })
    await prisma.productTemplate.delete({ where: { id } })
    let stockworksWarning: string | null = null
    if (existing) {
      try {
        await unlinkProductTemplateFromStockworks(existing)
      } catch (err: any) {
        stockworksWarning = err?.message || 'StockWorks unlink failed'
      }
    }
    return NextResponse.json({ ok: true, stockworksWarning })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete' }, { status: 400 })
  }
}
