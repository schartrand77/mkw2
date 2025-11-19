import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../../../_utils'
import { storageRoot } from '@/lib/storage'
import path from 'path'
import { readFile, unlink, writeFile } from 'fs/promises'
import sharp from 'sharp'
import { serializeModelImage } from '@/lib/model-images'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  await requireAdmin()
  const body = await req.json().catch(() => ({}))
  const image = await prisma.modelImage.findFirst({ where: { id: params.imageId, modelId: params.id } })
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: any = {}
  const rotateDirection = (() => {
    if (typeof body.rotate !== 'string') return null
    const dir = body.rotate.toLowerCase()
    if (dir === 'left' || dir === 'ccw' || dir === 'counterclockwise') return 'left'
    if (dir === 'right' || dir === 'cw' || dir === 'clockwise') return 'right'
    return null
  })()
  if ('caption' in body) {
    const raw = typeof body.caption === 'string' ? body.caption : ''
    updates.caption = raw ? raw.slice(0, 160) : null
  }
  if ('sortOrder' in body && body.sortOrder != null) {
    try {
      updates.sortOrder = BigInt(body.sortOrder)
    } catch {
      return NextResponse.json({ error: 'Invalid sort order' }, { status: 400 })
    }
  }
  if (Object.keys(updates).length === 0 && !body.setCover && !rotateDirection) {
    return NextResponse.json({ image: serializeModelImage(image) })
  }
  const updated = await prisma.modelImage.update({
    where: { id: image.id },
    data: updates,
  })
  if (body.setCover) {
    await prisma.model.update({ where: { id: params.id }, data: { coverImagePath: updated.filePath } })
  }
  if (rotateDirection) {
    const filePath = updated.filePath || image.filePath
    if (!filePath) return NextResponse.json({ error: 'Image file missing' }, { status: 400 })
    const abs = path.join(storageRoot(), filePath.replace(/^\/+/, ''))
    try {
      const buf = await readFile(abs)
      const rotated = await sharp(buf).rotate(rotateDirection === 'left' ? -90 : 90).toBuffer()
      await writeFile(abs, rotated)
    } catch (err) {
      console.error('Failed to rotate model image (admin)', err)
      return NextResponse.json({ error: 'Failed to rotate image' }, { status: 500 })
    }
  }
  return NextResponse.json({ image: serializeModelImage(updated) })
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
