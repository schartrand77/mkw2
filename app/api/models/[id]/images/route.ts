import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import sharp from 'sharp'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { saveBuffer } from '@/lib/storage'
import { MODEL_IMAGE_LIMIT, serializeModelImage, serializeModelImages } from '@/lib/model-images'
import { applyKnownOrientation, ensureProcessableImageBuffer } from '@/lib/image-processing'

export const dynamic = 'force-dynamic'

function normalizeFlag(value: FormDataEntryValue | null): boolean {
  if (!value) return false
  const str = String(value).toLowerCase()
  return str === '1' || str === 'true' || str === 'on'
}

async function guardModelEditor(modelId: string) {
  const userId = await getUserIdFromCookie()
  if (!userId) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const [model, me] = await Promise.all([
    prisma.model.findUnique({ where: { id: modelId }, select: { id: true, userId: true, coverImagePath: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }),
  ])
  if (!model) return { response: NextResponse.json({ error: 'Model not found' }, { status: 404 }) }
  if (model.userId !== userId && !me?.isAdmin) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { model }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardModelEditor(params.id)
  if ('response' in guard) return guard.response
  const [images] = await Promise.all([
    prisma.modelImage.findMany({ where: { modelId: guard.model.id }, orderBy: { sortOrder: 'asc' } }),
  ])
  return NextResponse.json({
    images: serializeModelImages(images),
    coverImagePath: guard.model.coverImagePath || null,
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await guardModelEditor(params.id)
  if ('response' in guard) return guard.response

  const existingCount = await prisma.modelImage.count({ where: { modelId: guard.model.id } })
  if (existingCount >= MODEL_IMAGE_LIMIT) {
    return NextResponse.json({ error: `Maximum of ${MODEL_IMAGE_LIMIT} images reached` }, { status: 400 })
  }

  const form = await req.formData()
  const image = form.get('image')
  if (!(image instanceof File)) return NextResponse.json({ error: 'Image file required' }, { status: 400 })
  const caption = ((form.get('caption') as string | null) || '').slice(0, 160) || null
  const setCover = normalizeFlag(form.get('setCover'))

  const buf = Buffer.from(await image.arrayBuffer())
  const prepared = await ensureProcessableImageBuffer(buf, { filename: image.name, mimeType: image.type })
  const pipeline = applyKnownOrientation(sharp(prepared.buffer), prepared.orientation)
  const processed = await pipeline.resize(1600, 1200, { fit: 'inside' }).webp({ quality: 88 }).toBuffer()
  const rel = path.join(guard.model.userId, 'gallery', `${guard.model.id}-${Date.now()}.webp`)
  await saveBuffer(rel, processed)
  const publicPath = `/${rel.replace(/\\/g, '/')}`

  const sortOrder = BigInt(Date.now())
  const created = await prisma.modelImage.create({
    data: { modelId: guard.model.id, filePath: publicPath, caption, sortOrder },
  })
  if (setCover) {
    await prisma.model.update({ where: { id: guard.model.id }, data: { coverImagePath: publicPath } })
  }
  return NextResponse.json({ image: serializeModelImage(created) })
}
