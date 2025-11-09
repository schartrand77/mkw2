import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const model = await prisma.model.findUnique({ where: { id: params.id }, include: { modelTags: { include: { tag: true } } } })
  if (!model) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const tags = model.modelTags.map(mt => ({ id: mt.tag.id, name: mt.tag.name, slug: mt.tag.slug }))
  const { modelTags, ...rest } = model as any
  return NextResponse.json({ model: { ...rest, tags } })
}
