import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { readFile, unlink, writeFile } from 'fs/promises'
import sharp from 'sharp'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { serializeModelImage } from '@/lib/model-images'
import { storageRoot } from '@/lib/storage'

export const dynamic = 'force-dynamic'

async function guardModelEditor(modelId: string) {
  const userId = await getUserIdFromCookie()
  if (!userId) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const [model, me] = await Promise.all([
    prisma.model.findUnique({ where: { id: modelId }, select: { id: true, userId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }),
  ])
  if (!model) return { response: NextResponse.json({ error: 'Model not found' }, { status: 404 }) }
  if (model.userId !== userId && !me?.isAdmin) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { model }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  const guard = await guardModelEditor(params.id)
  if ('response' in guard) return guard.response
  const body = await req.json().catch(() => ({}))
  const image = await prisma.modelImage.findFirst({ where: { id: params.imageId, modelId: guard.model.id } })
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
  const updated = Object.keys(updates).length
    ? await prisma.modelImage.update({
        where: { id: image.id },
        data: updates,
      })
    : image
  if (body.setCover) {
    await prisma.model.update({ where: { id: guard.model.id }, data: { coverImagePath: updated.filePath } })
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
      console.error('Failed to rotate model image', err)
      return NextResponse.json({ error: 'Failed to rotate image' }, { status: 500 })
    }
  }
  return NextResponse.json({ image: serializeModelImage(updated) })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  const guard = await guardModelEditor(params.id)
  if ('response' in guard) return guard.response
  const image = await prisma.modelImage.findFirst({ where: { id: params.imageId, modelId: guard.model.id } })
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.modelImage.delete({ where: { id: image.id } })
  try {
    await unlink(path.join(storageRoot(), image.filePath.replace(/^\/+/, '')))
  } catch {}
  return NextResponse.json({ ok: true })
}
