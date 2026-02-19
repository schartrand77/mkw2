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
import { getAdminAuditRequestMeta, recordAdminAuditEvent } from '@/lib/admin-audit'

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
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
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
        stockworksCategory: true,
        stockworksSku: true,
        stockworksDesigner: true,
        stockworksMarketplace: true,
        stockworksFileLocation: true,
        stockworksVersion: true,
        stockworksUnitPriceUsd: true,
        stockworksStatus: true,
        stockworksNotes: true,
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
    const nextStockworksCategory = parsed.stockworksCategory === null
      ? null
      : (parsed.stockworksCategory?.trim() || existing.stockworksCategory || 'models')
    const nextStockworksSku = parsed.stockworksSku === null
      ? null
      : (parsed.stockworksSku?.trim() || existing.stockworksSku)
    const nextStockworksDesigner = parsed.stockworksDesigner === null
      ? null
      : (parsed.stockworksDesigner?.trim() || existing.stockworksDesigner)
    const nextStockworksMarketplace = parsed.stockworksMarketplace === null
      ? null
      : (parsed.stockworksMarketplace?.trim() || existing.stockworksMarketplace)
    const nextStockworksFileLocation = parsed.stockworksFileLocation === null
      ? null
      : (parsed.stockworksFileLocation?.trim() || existing.stockworksFileLocation)
    const nextStockworksVersion = parsed.stockworksVersion === null
      ? null
      : (parsed.stockworksVersion?.trim() || existing.stockworksVersion)
    const nextStockworksUnitPriceUsd = parsed.stockworksUnitPriceUsd === null
      ? null
      : (parsed.stockworksUnitPriceUsd ?? existing.stockworksUnitPriceUsd)
    const nextStockworksStatus = parsed.stockworksStatus === null
      ? null
      : (parsed.stockworksStatus?.trim() || existing.stockworksStatus || 'Active')
    const nextStockworksNotes = parsed.stockworksNotes === null
      ? null
      : (parsed.stockworksNotes?.trim() || existing.stockworksNotes)
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
        category: nextStockworksCategory,
        sku: nextStockworksSku,
        designer: nextStockworksDesigner,
        marketplace: nextStockworksMarketplace,
        fileLocation: nextStockworksFileLocation,
        version: nextStockworksVersion,
        unitPriceUsd: nextStockworksUnitPriceUsd,
        status: nextStockworksStatus,
        notes: nextStockworksNotes,
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
        stockworksCategory: parsed.stockworksCategory === null ? null : parsed.stockworksCategory?.trim() || undefined,
        stockworksSku: parsed.stockworksSku === null ? null : parsed.stockworksSku?.trim() || undefined,
        stockworksDesigner: parsed.stockworksDesigner === null ? null : parsed.stockworksDesigner?.trim() || undefined,
        stockworksMarketplace: parsed.stockworksMarketplace === null ? null : parsed.stockworksMarketplace?.trim() || undefined,
        stockworksFileLocation: parsed.stockworksFileLocation === null ? null : parsed.stockworksFileLocation?.trim() || undefined,
        stockworksVersion: parsed.stockworksVersion === null ? null : parsed.stockworksVersion?.trim() || undefined,
        stockworksUnitPriceUsd: parsed.stockworksUnitPriceUsd === null ? null : parsed.stockworksUnitPriceUsd,
        stockworksStatus: parsed.stockworksStatus === null ? null : parsed.stockworksStatus?.trim() || undefined,
        stockworksNotes: parsed.stockworksNotes === null ? null : parsed.stockworksNotes?.trim() || undefined,
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
    const requestMeta = getAdminAuditRequestMeta(req)
    await recordAdminAuditEvent({
      adminId,
      action: 'admin.product_template.update',
      targetType: 'product_template',
      targetId: id,
      requestMethod: requestMeta.requestMethod,
      requestPath: requestMeta.requestPath,
      requestIp: requestMeta.requestIp,
      userAgent: requestMeta.userAgent,
      metadata: { updatedKeys: Object.keys(parsed), stockworksWarning } as any,
    })
    return NextResponse.json({ product: hydrated || product, stockworksWarning })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to save product' }, { status: 400 })
  }
}

export async function DELETE(req: Request, { params }: RouteContext) {
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
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
    const requestMeta = getAdminAuditRequestMeta(req)
    await recordAdminAuditEvent({
      adminId,
      action: 'admin.product_template.delete',
      targetType: 'product_template',
      targetId: id,
      requestMethod: requestMeta.requestMethod,
      requestPath: requestMeta.requestPath,
      requestIp: requestMeta.requestIp,
      userAgent: requestMeta.userAgent,
      metadata: { stockworksWarning } as any,
    })
    return NextResponse.json({ ok: true, stockworksWarning })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete' }, { status: 400 })
  }
}
