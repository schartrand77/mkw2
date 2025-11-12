import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../../../_utils'
import { storageRoot } from '@/lib/storage'
import path from 'path'
import { unlink } from 'fs/promises'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  await requireAdmin()
  const body = await req.json().catch(() => ({}))
  const image = await prisma.modelImage.findFirst({ where: { id: params.imageId, modelId: params.id } })
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: any = {}
  if ('caption' in body) {
    const raw = typeof body.caption === 'string' ? body.caption : ''
    updates.caption = raw ? raw.slice(0, 160) : null
  }
  if ('sortOrder' in body && Number.isFinite(Number(body.sortOrder))) {
    updates.sortOrder = Number(body.sortOrder)
  }
  if (Object.keys(updates).length === 0 && !body.setCover) {
    return NextResponse.json({ image })
  }
  const updated = await prisma.modelImage.update({
    where: { id: image.id },
    data: updates,
  })
  if (body.setCover) {
    await prisma.model.update({ where: { id: params.id }, data: { coverImagePath: updated.filePath } })
  }
  return NextResponse.json({ image: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  await requireAdmin()
  const image = await prisma.modelImage.findFirst({ where: { id: params.imageId, modelId: params.id } })
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.modelImage.delete({ where: { id: image.id } })
  try {
    await unlink(path.join(storageRoot(), image.filePath.replace(/^\/+/, '')))
  } catch {}
  return NextResponse.json({ ok: true })
}
