import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
import { syncProductTemplateToStockworks, syncStockworksModelsToProductTemplates } from '@/lib/stockworks-products'
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

export async function GET() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try { await syncStockworksModelsToProductTemplates() } catch {}
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
    if (parsed.baseModelId) {
      const baseModel = await prisma.model.findUnique({
        where: { id: parsed.baseModelId },
        select: { id: true },
      })
      if (!baseModel) {
        return NextResponse.json({ error: 'Base model not found.' }, { status: 400 })
      }
    }
    const created = await prisma.productTemplate.create({
      data: {
        title: parsed.title,
        description: parsed.description || undefined,
        baseModelId: parsed.baseModelId || undefined,
        lockedMaterial: parsed.lockedMaterial || undefined,
        lockedColor: parsed.lockedColor || null,
        lockedColorCount: parsed.lockedColorCount ?? 1,
        lockedScale: parsed.lockedScale ?? 1,
        lockedFinish: parsed.lockedFinish || 'standard',
        lockedPriceMultiplier: parsed.lockedPriceMultiplier ?? 1,
        materialOptions: parsed.materialOptions || undefined,
        colorOptions: parsed.colorOptions || undefined,
        sizeOptions: parsed.sizeOptions || undefined,
        isActive: parsed.isActive ?? true,
      },
    })
    let product = created
    let stockworksWarning: string | null = null
    try {
      const synced = await syncProductTemplateToStockworks({
        title: created.title,
        material: created.lockedMaterial,
        color: created.lockedColor,
      })
      product = await prisma.productTemplate.update({
        where: { id: created.id },
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
    return NextResponse.json({ product: hydrated || product, adminId, stockworksWarning })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
