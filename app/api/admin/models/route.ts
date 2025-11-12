import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20))
  const where: any = q ? { OR: [ { title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } } ] } : {}
  const [total, items] = await Promise.all([
    prisma.model.count({ where }),
    prisma.model.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { modelTags: { include: { tag: true } } } })
  ])
  const models = items.map(m => ({
    id: m.id,
    title: m.title,
    coverImagePath: m.coverImagePath,
    visibility: m.visibility,
    tags: m.modelTags.map(mt => mt.tag.name),
    affiliateTitle: (m as any).affiliateTitle,
    affiliateUrl: (m as any).affiliateUrl,
    videoEmbedId: (m as any).videoEmbedId,
  }))
  return NextResponse.json({ total, page, pageSize, models })
}
