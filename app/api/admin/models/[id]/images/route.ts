import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../../_utils'
import path from 'path'
import { saveBuffer } from '@/lib/storage'
import { MODEL_IMAGE_LIMIT, serializeModelImage, serializeModelImages } from '@/lib/model-images'
import { enqueueImageProcessing } from '@/lib/processing-jobs'

export const dynamic = 'force-dynamic'

const IMAGE_LIMIT = MODEL_IMAGE_LIMIT

type AdminModelImagesContext = { params: Promise<{ id: string }> }

function normalizeFlag(value: FormDataEntryValue | null): boolean {
  if (!value) return false
  const str = String(value).toLowerCase()
  return str === '1' || str === 'true' || str === 'on'
}

export async function GET(_req: NextRequest, { params }: AdminModelImagesContext) {
  const { id } = await params
  await requireAdmin()
  const [images, model] = await Promise.all([
    prisma.modelImage.findMany({ where: { modelId: id }, orderBy: { sortOrder: 'asc' } }),
    prisma.model.findUnique({ where: { id }, select: { coverImagePath: true, coverImageStatus: true } }),
  ])
  return NextResponse.json({
    images: serializeModelImages(images),
    coverImagePath: model?.coverImagePath || null,
    coverImageStatus: model?.coverImageStatus || null,
  })
}

export async function POST(req: NextRequest, { params }: AdminModelImagesContext) {
  const { id } = await params
  await requireAdmin()
  const model = await prisma.model.findUnique({ where: { id }, select: { id: true, userId: true, coverImagePath: true } })
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
  if (buf.length === 0) return NextResponse.json({ error: 'Image upload failed' }, { status: 400 })
  const ext = path.extname(image.name) || '.bin'
  const sourceRel = path.join(model.userId, 'gallery', 'raw', `${model.id}-${Date.now()}${ext}`)
  await saveBuffer(sourceRel, buf)
  const rel = path.join(model.userId, 'gallery', `${model.id}-${Date.now()}.webp`)
  const publicPath = `/${rel.replace(/\\/g, '/')}`

  const sortOrder = BigInt(Date.now())
  const created = await prisma.modelImage.create({
    data: { modelId: model.id, filePath: publicPath, caption, sortOrder, sourcePath: `/${sourceRel.replace(/\\/g, '/')}`, status: 'processing' },
  })
  if (setCover) {
    await prisma.model.update({ where: { id: model.id }, data: { coverImagePath: publicPath, coverImageStatus: 'processing' } })
  }
  try {
    await enqueueImageProcessing({
      modelId: model.id,
      includeAvatars: false,
      includeComments: false,
      limit: 1,
      idempotencyKey: `image:model:${model.id}`,
    })
  } catch (err) {
    console.warn('Failed to process model image (admin)', err)
  }
  return NextResponse.json({ image: serializeModelImage(created) })
}
