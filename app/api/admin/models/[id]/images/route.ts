import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../../_utils'
import path from 'path'
import sharp from 'sharp'
import { saveBuffer } from '@/lib/storage'
import { serializeModelImage, serializeModelImages } from '@/lib/model-images'

export const dynamic = 'force-dynamic'

const IMAGE_LIMIT = 20

function normalizeFlag(value: FormDataEntryValue | null): boolean {
  if (!value) return false
  const str = String(value).toLowerCase()
  return str === '1' || str === 'true' || str === 'on'
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await requireAdmin()
  const [images, model] = await Promise.all([
    prisma.modelImage.findMany({ where: { modelId: params.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.model.findUnique({ where: { id: params.id }, select: { coverImagePath: true } }),
  ])
  return NextResponse.json({ images: serializeModelImages(images), coverImagePath: model?.coverImagePath || null })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await requireAdmin()
  const model = await prisma.model.findUnique({ where: { id: params.id }, select: { id: true, userId: true, coverImagePath: true } })
  if (!model) return NextResponse.json({ error: 'Model not found' }, { status: 404 })

  const existingCount = await prisma.modelImage.count({ where: { modelId: model.id } })
  if (existingCount >= IMAGE_LIMIT) {
    return NextResponse.json({ error: `Maximum of ${IMAGE_LIMIT} images reached` }, { status: 400 })
  }

  const form = await req.formData()
  const image = form.get('image')
  if (!(image instanceof File)) return NextResponse.json({ error: 'Image file required' }, { status: 400 })
  const caption = ((form.get('caption') as string | null) || '').slice(0, 160) || null
  const setCover = normalizeFlag(form.get('setCover'))

  const buf = Buffer.from(await image.arrayBuffer())
  const processed = await sharp(buf).rotate().resize(1600, 1200, { fit: 'inside' }).webp({ quality: 88 }).toBuffer()
  const rel = path.join(model.userId, 'gallery', `${model.id}-${Date.now()}.webp`)
  await saveBuffer(rel, processed)
  const publicPath = `/${rel.replace(/\\/g, '/')}`

  const sortOrder = BigInt(Date.now())
  const created = await prisma.modelImage.create({
    data: { modelId: model.id, filePath: publicPath, caption, sortOrder },
  })
  if (setCover) {
    await prisma.model.update({ where: { id: model.id }, data: { coverImagePath: publicPath } })
  }
  return NextResponse.json({ image: serializeModelImage(created) })
}
