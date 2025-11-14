import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const models = await prisma.model.findMany({
    where: q ? { OR: [ { title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } } ] } : {},
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, title: true, coverImagePath: true, visibility: true }
  })
  return NextResponse.json({ models })
}
