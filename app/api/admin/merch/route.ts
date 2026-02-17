import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().min(1).max(60).optional().nullable(),
  priceUsd: z.number().nonnegative().optional().nullable(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  externalUrl: z.string().trim().url().max(500).optional().nullable(),
  ctaLabel: z.string().trim().max(40).optional().nullable(),
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
      data: {
        title: parsed.title,
        description: parsed.description || null,
        category: parsed.category || 'Merch',
        priceUsd: parsed.priceUsd ?? null,
        imageUrl: normalizeSelfHostedImagePath(parsed.imageUrl),
        externalUrl: parsed.externalUrl || null,
        ctaLabel: parsed.ctaLabel || null,
        isActive: parsed.isActive ?? true,
        sortOrder: parsed.sortOrder ?? 0,
      },
    })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
