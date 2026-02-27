import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
import { z } from 'zod'
import { syncMerchItemToStockworks } from '@/lib/stockworks-merch'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().min(1).max(60).optional().nullable(),
  availability: z.enum(['in_stock', 'back_ordered']).optional(),
  priceUsd: z.number().nonnegative().optional().nullable(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  galleryImageUrls: z.array(z.string().trim().max(500)).max(24).optional().nullable(),
  externalUrl: z.string().trim().url().max(500).optional().nullable(),
  ctaLabel: z.string().trim().max(40).optional().nullable(),
  sizeOptions: z.array(z.string().trim().min(1).max(40)).max(64).optional().nullable(),
  colorOptions: z.array(z.string().trim().min(1).max(40)).max(64).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

function normalizeSelfHostedImagePath(value?: string | null) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error('Merch image must be uploaded and self-hosted.')
  }
  if (!trimmed.startsWith('/')) {
    throw new Error('Merch image path must start with "/".')
  }
  return trimmed
}

function normalizeSelfHostedImagePaths(values?: (string | null | undefined)[] | null): string[] {
  if (!Array.isArray(values)) return []
  const output: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const normalized = normalizeSelfHostedImagePath(value || null)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    output.push(normalized)
  }
  return output.slice(0, 24)
}

export async function GET() {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  const items = await prisma.merchItem.findMany({
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
  })
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const parsed = schema.parse(await req.json())
    const item = await prisma.merchItem.create({
      data: (() => {
        const galleryImageUrls = normalizeSelfHostedImagePaths(parsed.galleryImageUrls)
        const imageUrl = normalizeSelfHostedImagePath(parsed.imageUrl) || galleryImageUrls?.[0] || null
        return {
          title: parsed.title,
          description: parsed.description || null,
          category: parsed.category || 'Merch',
          availability: parsed.availability || 'in_stock',
          priceUsd: parsed.priceUsd ?? null,
          imageUrl,
          galleryImageUrls: galleryImageUrls ?? Prisma.JsonNull,
          externalUrl: parsed.externalUrl || null,
          ctaLabel: parsed.ctaLabel || null,
          sizeOptions: parsed.sizeOptions ?? Prisma.JsonNull,
          colorOptions: parsed.colorOptions ?? Prisma.JsonNull,
          isActive: parsed.isActive ?? true,
          sortOrder: parsed.sortOrder ?? 0,
        }
      })(),
    })
    let stockworksWarning: string | null = null
    let syncedItem = item
    try {
      const synced = await syncMerchItemToStockworks({
        id: item.id,
        title: item.title,
        category: item.category,
        priceUsd: item.priceUsd,
        sizeOptions: item.sizeOptions,
        colorOptions: item.colorOptions,
        stockworksCategory: item.stockworksCategory,
        stockworksStatus: item.stockworksStatus,
        stockworksNotes: item.stockworksNotes,
        stockworksVariantMap: item.stockworksVariantMap,
      })
      syncedItem = await prisma.merchItem.update({
        where: { id: item.id },
        data: {
          sizeOptions: synced.sizeOptions,
          colorOptions: synced.colorOptions,
          stockworksVariantMap: synced.stockworksVariantMap,
          stockworksCategory: item.stockworksCategory || 'merch',
          stockworksStatus: item.stockworksStatus || 'Active',
        },
      })
    } catch (err: any) {
      stockworksWarning = err?.message || 'StockWorks merch sync failed.'
    }
    return NextResponse.json({ item: syncedItem, stockworksWarning })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
