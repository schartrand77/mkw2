import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().min(1).max(60).optional().nullable(),
  priceUsd: z.number().nonnegative().optional().nullable(),
  imageUrl: z.string().trim().url().max(500).optional().nullable(),
  externalUrl: z.string().trim().url().max(500).optional().nullable(),
  ctaLabel: z.string().trim().max(40).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const { id } = await params
    const parsed = schema.parse(await req.json())
    const item = await prisma.merchItem.update({
      where: { id },
      data: {
        title: parsed.title ?? undefined,
        description: parsed.description === undefined ? undefined : (parsed.description || null),
        category: parsed.category === undefined ? undefined : (parsed.category || 'Merch'),
        priceUsd: parsed.priceUsd ?? undefined,
        imageUrl: parsed.imageUrl === undefined ? undefined : (parsed.imageUrl || null),
        externalUrl: parsed.externalUrl === undefined ? undefined : (parsed.externalUrl || null),
        ctaLabel: parsed.ctaLabel === undefined ? undefined : (parsed.ctaLabel || null),
        isActive: parsed.isActive ?? undefined,
        sortOrder: parsed.sortOrder ?? undefined,
      },
    })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  try {
    const { id } = await params
    await prisma.merchItem.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Delete failed' }, { status: 400 })
  }
}
