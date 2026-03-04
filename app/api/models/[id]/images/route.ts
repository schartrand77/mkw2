import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { saveBuffer } from '@/lib/storage'
import { MODEL_IMAGE_LIMIT, serializeModelImage, serializeModelImages } from '@/lib/model-images'
import { enqueueImageProcessing } from '@/lib/processing-jobs'

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
    prisma.model.findUnique({ where: { id: modelId }, select: { id: true, userId: true, coverImagePath: true, coverImageStatus: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }),
  ])
  if (!model) return { response: NextResponse.json({ error: 'Model not found' }, { status: 404 }) }
  if (model.userId !== userId && !me?.isAdmin) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { model }
}

type ModelImagesContext = { params: Promise<{ id: string }> }

function getUploadFile(form: FormData): File | null {
  const entry = form.get('image') ?? form.get('file')
  if (!entry) return null
  if (typeof File !== 'undefined' && entry instanceof File) return entry
  if (entry instanceof Blob) {
    return new File([entry], 'upload.bin', { type: entry.type || 'application/octet-stream' })
  }
  return null
}

export async function GET(_req: NextRequest, { params }: ModelImagesContext) {
  const { id } = await params
  const guard = await guardModelEditor(id)
  if ('response' in guard) return guard.response
  const [images] = await Promise.all([
    prisma.modelImage.findMany({ where: { modelId: guard.model.id }, orderBy: { sortOrder: 'asc' } }),
  ])
  return NextResponse.json({
    images: serializeModelImages(images),
    coverImagePath: guard.model.coverImagePath || null,
    coverImageStatus: guard.model.coverImageStatus || null,
  })
}

export async function POST(req: NextRequest, { params }: ModelImagesContext) {
  const { id } = await params
  const guard = await guardModelEditor(id)
  if ('response' in guard) return guard.response

  const existingCount = await prisma.modelImage.count({ where: { modelId: guard.model.id } })
  if (existingCount >= MODEL_IMAGE_LIMIT) {
    return NextResponse.json({ error: `Maximum of ${MODEL_IMAGE_LIMIT} images reached` }, { status: 400 })
  }

  const form = await req.formData()
  const image = getUploadFile(form)
  if (!image) return NextResponse.json({ error: 'Image file required' }, { status: 400 })
  const caption = ((form.get('caption') as string | null) || '').slice(0, 160) || null
  const setCover = normalizeFlag(form.get('setCover'))

  const buf = Buffer.from(await image.arrayBuffer())
  if (buf.length === 0) return NextResponse.json({ error: 'Image upload failed' }, { status: 400 })
  const ext = path.extname(image.name) || '.bin'
  const sourceRel = path.join(guard.model.userId, 'gallery', 'raw', `${guard.model.id}-${Date.now()}${ext}`)
  await saveBuffer(sourceRel, buf)
  const rel = path.join(guard.model.userId, 'gallery', `${guard.model.id}-${Date.now()}.webp`)
  const publicPath = `/${rel.replace(/\\/g, '/')}`

  const sortOrder = BigInt(Date.now())
  const created = await prisma.modelImage.create({
    data: { modelId: guard.model.id, filePath: publicPath, caption, sortOrder, sourcePath: `/${sourceRel.replace(/\\/g, '/')}`, status: 'processing' },
  })
  if (setCover) {
    await prisma.model.update({ where: { id: guard.model.id }, data: { coverImagePath: publicPath, coverImageStatus: 'processing' } })
  }
  try {
    await enqueueImageProcessing({
      modelId: guard.model.id,
      includeAvatars: false,
      includeComments: false,
      limit: 1,
      idempotencyKey: `image:model:${guard.model.id}`,
    })
  } catch (err) {
    console.warn('Failed to process model image', err)
  }
  return NextResponse.json({ image: serializeModelImage(created) })
}
