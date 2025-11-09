import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'

export async function GET() {
  const top = await prisma.modelTag.groupBy({
    by: ['tagId'],
    _count: { tagId: true },
    orderBy: { _count: { tagId: 'desc' } },
    take: 50,
  })
  const tags = await prisma.tag.findMany({ where: { id: { in: top.map(t => t.tagId) } } })
  const tagMap = new Map(tags.map(t => [t.id, t]))
  const res = top.map(t => ({ id: t.tagId, name: tagMap.get(t.tagId)?.name, slug: tagMap.get(t.tagId)?.slug, count: (t as any)._count.tagId }))
  return NextResponse.json({ tags: res })
}
