import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { unlink } from 'fs/promises'
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
  if (Object.keys(updates).length === 0 && !body.setCover) {
    return NextResponse.json({ image: serializeModelImage(image) })
  }
  const updated = await prisma.modelImage.update({
    where: { id: image.id },
    data: updates,
  })
  if (body.setCover) {
    await prisma.model.update({ where: { id: guard.model.id }, data: { coverImagePath: updated.filePath } })
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
