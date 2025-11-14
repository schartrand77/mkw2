import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
export const dynamic = 'force-dynamic'

export async function GET() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const items = await prisma.featuredModel.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: { model: { select: { id: true, title: true, coverImagePath: true, visibility: true } } },
  })
  return NextResponse.json({ featured: items.map(i => i.model) })
}

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const incoming: string[] = Array.isArray(body?.modelIds) ? body.modelIds : []
  const modelIds = incoming
    .map((id) => String(id).trim())
    .filter(Boolean)
    .slice(0, 24)

  if (!modelIds.length) {
    await prisma.featuredModel.deleteMany({})
    return NextResponse.json({ featured: [] })
  }

  // Ensure all requested models exist
  const found = await prisma.model.findMany({ where: { id: { in: modelIds } }, select: { id: true } })
  const foundIds = new Set(found.map(f => f.id))
  const cleanIds = modelIds.filter((id, idx) => foundIds.has(id) && modelIds.indexOf(id) === idx)
  if (!cleanIds.length) {
    await prisma.featuredModel.deleteMany({})
    return NextResponse.json({ featured: [] })
  }

  await prisma.$transaction(async (tx) => {
    await tx.featuredModel.deleteMany({ where: { modelId: { notIn: cleanIds } } })
    for (let i = 0; i < cleanIds.length; i++) {
      const id = cleanIds[i]
      await tx.featuredModel.upsert({
        where: { modelId: id },
        update: { position: i },
        create: { modelId: id, position: i },
      })
    }
  })

  const items = await prisma.featuredModel.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: { model: { select: { id: true, title: true, coverImagePath: true, visibility: true } } },
  })

  return NextResponse.json({ featured: items.map(i => i.model) })
}
