import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
import { syncProductTemplateToStockworks, syncStockworksModelsToProductTemplates } from '@/lib/stockworks-products'
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
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  baseModelId: z.string().cuid().optional().nullable(),
  stockworksCategory: z.string().max(80).optional().nullable(),
  stockworksSku: z.string().max(120).optional().nullable(),
  stockworksDesigner: z.string().max(120).optional().nullable(),
  stockworksMarketplace: z.string().max(120).optional().nullable(),
  stockworksFileLocation: z.string().max(500).optional().nullable(),
  stockworksVersion: z.string().max(80).optional().nullable(),
  stockworksUnitPriceUsd: z.number().min(0).max(100000).optional().nullable(),
  stockworksStatus: z.string().max(40).optional().nullable(),
  stockworksNotes: z.string().max(4000).optional().nullable(),
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
      // Keep incoming product creation aligned with StockWorks intake defaults/options.
      data: (() => {
        const locked = buildLockedTemplateOptions({
          material: parsed.lockedMaterial,
          color: parsed.lockedColor,
          colorCount: parsed.lockedColorCount,
          scale: parsed.lockedScale,
          finish: parsed.lockedFinish,
          priceMultiplier: parsed.lockedPriceMultiplier,
        })
        return {
          title: parsed.title,
          description: parsed.description || undefined,
          baseModelId: parsed.baseModelId || undefined,
          stockworksCategory: parsed.stockworksCategory?.trim() || 'models',
          stockworksSku: parsed.stockworksSku?.trim() || null,
          stockworksDesigner: parsed.stockworksDesigner?.trim() || null,
          stockworksMarketplace: parsed.stockworksMarketplace?.trim() || null,
          stockworksFileLocation: parsed.stockworksFileLocation?.trim() || null,
          stockworksVersion: parsed.stockworksVersion?.trim() || null,
          stockworksUnitPriceUsd: parsed.stockworksUnitPriceUsd ?? null,
          stockworksStatus: parsed.stockworksStatus?.trim() || 'Active',
          stockworksNotes: parsed.stockworksNotes?.trim() || null,
          lockedMaterial: locked.material,
          lockedColor: locked.color,
          lockedColorCount: locked.colorCount,
          lockedScale: locked.scale,
          lockedFinish: locked.finish,
          lockedPriceMultiplier: locked.priceMultiplier,
          materialOptions: parsed.materialOptions || locked.materialOptions,
          colorOptions: parsed.colorOptions || locked.colorOptions,
          sizeOptions: parsed.sizeOptions || locked.sizeOptions,
          isActive: parsed.isActive ?? true,
        }
      })(),
    })

    let stockworksWarning: string | null = null
    let hydrated = await prisma.productTemplate.findUnique({
      where: { id: created.id },
      include: { baseModel: { select: { id: true, title: true } } },
    })
    try {
      const synced = await syncProductTemplateToStockworks({
        title: created.title,
        material: created.lockedMaterial,
        color: created.lockedColor,
        category: created.stockworksCategory,
        sku: created.stockworksSku,
        designer: created.stockworksDesigner,
        marketplace: created.stockworksMarketplace,
        fileLocation: created.stockworksFileLocation,
        version: created.stockworksVersion,
        unitPriceUsd: created.stockworksUnitPriceUsd,
        status: created.stockworksStatus,
        notes: created.stockworksNotes,
      })

      const product = await prisma.productTemplate.update({
        where: { id: created.id },
        data: {
          stockworksMaterialId: synced.materialId ?? null,
          stockworksInventoryItemId: synced.inventoryItemId ?? null,
        },
      })

      hydrated = await prisma.productTemplate.findUnique({
        where: { id: product.id },
        include: { baseModel: { select: { id: true, title: true } } },
      })
    } catch (err: any) {
      stockworksWarning = err?.message || 'Failed to sync product to StockWorks inventory models.'
    }

    return NextResponse.json({ product: hydrated || created, adminId, stockworksWarning })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
