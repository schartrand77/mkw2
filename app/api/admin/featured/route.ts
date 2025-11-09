import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../_utils'
export const dynamic = 'force-dynamic'

export async function GET() {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const items = await prisma.featuredModel.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: { model: { select: { id: true, title: true, coverImagePath: true } } },
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
  const modelIds: string[] = Array.isArray(body?.modelIds) ? body.modelIds.slice(0, 24) : []
  if (!modelIds.length) return NextResponse.json({ error: 'modelIds required' }, { status: 400 })

  // Ensure all models exist
  const found = await prisma.model.findMany({ where: { id: { in: modelIds } }, select: { id: true } })
  const foundIds = new Set(found.map(f => f.id))
  const cleanIds = modelIds.filter((id) => foundIds.has(id))
  if (!cleanIds.length) return NextResponse.json({ error: 'No valid models' }, { status: 400 })

  await prisma.$transaction(async (tx) => {
    // Remove those not in list
    await tx.featuredModel.deleteMany({ where: { modelId: { notIn: cleanIds } } })
    // Upsert with new positions
    for (let i = 0; i < cleanIds.length; i++) {
      await tx.featuredModel.upsert({
        where: { modelId: cleanIds[i] },
        update: { position: i },
        create: { modelId: cleanIds[i], position: i },
      })
    }
  })

  return NextResponse.json({ ok: true })
}
