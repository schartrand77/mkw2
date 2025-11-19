import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../../../_utils'
import { storageRoot } from '@/lib/storage'
import path from 'path'
import { readFile, unlink, writeFile } from 'fs/promises'
import sharp from 'sharp'
import { serializeModelImage } from '@/lib/model-images'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

function normalizeTurns(value: number) {
  if (!Number.isFinite(value)) return 0
  const steps = Math.round(value)
  if (steps === 0) return 0
  const mod = ((steps % 4) + 4) % 4
  return mod > 2 ? mod - 4 : mod
}

function extractRotateTurns(body: any, rotateDirection: 'left' | 'right' | null) {
  if (typeof body?.rotateTurns === 'number' && Number.isFinite(body.rotateTurns)) {
    const turns = normalizeTurns(body.rotateTurns)
    if (turns !== 0) return turns
  }
  if (rotateDirection) return rotateDirection === 'left' ? -1 : 1
  return 0
}

function revalidateModelPaths(id: string) {
  try {
    revalidatePath('/')
    revalidatePath('/discover')
    revalidatePath(`/models/${id}`)
  } catch {
    // ignore
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  await requireAdmin()
  const body = await req.json().catch(() => ({}))
  const [image, model] = await Promise.all([
    prisma.modelImage.findFirst({ where: { id: params.imageId, modelId: params.id } }),
    prisma.model.findUnique({ where: { id: params.id }, select: { coverImagePath: true } }),
  ])
  if (!image || !model) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: any = {}
  const rotateDirection = (() => {
    if (typeof body.rotate !== 'string') return null
    const dir = body.rotate.toLowerCase()
    if (dir === 'left' || dir === 'ccw' || dir === 'counterclockwise') return 'left'
    if (dir === 'right' || dir === 'cw' || dir === 'clockwise') return 'right'
    return null
  })()
  const rotateTurns = extractRotateTurns(body, rotateDirection)
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
  if (Object.keys(updates).length === 0 && !body.setCover && !rotateTurns) {
    return NextResponse.json({ image: serializeModelImage(image) })
  }
  const updated = await prisma.modelImage.update({
    where: { id: image.id },
    data: updates,
  })
  const filePath = updated.filePath || image.filePath
  const isCoverImage = !!(body.setCover || (model.coverImagePath && filePath === model.coverImagePath))
  if (body.setCover) {
    await prisma.model.update({ where: { id: params.id }, data: { coverImagePath: updated.filePath } })
    revalidateModelPaths(params.id)
  }
  if (rotateTurns) {
    if (!filePath) return NextResponse.json({ error: 'Image file missing' }, { status: 400 })
    const abs = path.join(storageRoot(), filePath.replace(/^\/+/, ''))
    try {
      const buf = await readFile(abs)
      const rotated = await sharp(buf).rotate(rotateTurns * 90).toBuffer()
      await writeFile(abs, rotated)
    } catch (err) {
      console.error('Failed to rotate model image (admin)', err)
      return NextResponse.json({ error: 'Failed to rotate image' }, { status: 500 })
    }
    if (isCoverImage) {
      await prisma.model.update({ where: { id: params.id }, data: { coverImagePath: model.coverImagePath } })
      revalidateModelPaths(params.id)
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
