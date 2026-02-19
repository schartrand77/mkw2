import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import {
  commentInclude,
  commentUserSelect,
  detectCommentViolation,
  findVerifiedCommentUserIds,
  serializeComment,
  userHasModelReceipt,
} from '@/lib/comments'
import { saveBuffer } from '@/lib/storage'
import { CACHE_TAGS, modelCommentsTag, modelTag } from '@/lib/cache-policy'

export const dynamic = 'force-dynamic'

const MIN_LENGTH = 2
const MAX_LENGTH = 1000

function normalizeBody(body: unknown): string {
  if (typeof body === 'string') return body.trim()
  if (typeof body === 'number') return String(body).trim()
  return ''
}

type ModelCommentsContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: ModelCommentsContext) {
  const { id } = await params
  const comments = await prisma.modelComment.findMany({
    where: { modelId: id },
    orderBy: commentInclude.orderBy,
    include: commentInclude.include,
  })
  const verified = await findVerifiedCommentUserIds(id, comments.map(c => c.userId))
  const payload = comments.map((comment) => serializeComment({
    ...comment,
    isVerified: comment.userId ? verified.has(comment.userId) : false,
  }))
  return NextResponse.json({ comments: payload })
}

export async function POST(req: NextRequest, { params }: ModelCommentsContext) {
  const { id } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let bodyText = ''
  let type: 'comment' | 'make' = 'comment'
  let imageFile: File | null = null
  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    bodyText = normalizeBody(form.get('body'))
    const rawType = ((form.get('type') as string | null) || '').toLowerCase()
    if (rawType === 'make') type = 'make'
    const maybeFile = form.get('image')
    if (maybeFile instanceof File) {
      imageFile = maybeFile
    }
  } else {
    try {
      const payload = await req.json()
      bodyText = normalizeBody(payload?.body)
      if ((payload?.type || '').toLowerCase() === 'make') {
        type = 'make'
      }
    } catch {
      bodyText = ''
    }
  }

  if (bodyText.length < MIN_LENGTH) {
    return NextResponse.json({ error: 'Comment is too short' }, { status: 400 })
  }
  if (bodyText.length > MAX_LENGTH) {
    return NextResponse.json({ error: 'Comment is too long' }, { status: 400 })
  }
  const violation = detectCommentViolation(bodyText)
  if (violation) {
    return NextResponse.json({ error: violation }, { status: 400 })
  }
  if (type === 'make' && !(imageFile instanceof File)) {
    return NextResponse.json({ error: 'Add a photo of your make to share it.' }, { status: 400 })
  }

  const model = await prisma.model.findUnique({
    where: { id },
    select: { id: true, visibility: true, userId: true },
  })
  if (!model) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let allowComment = model.visibility === 'public' || model.userId === userId
  if (!allowComment) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
    allowComment = !!me?.isAdmin
  }
  if (!allowComment) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let imagePath: string | null = null
  let imageWidth: number | null = null
  let imageHeight: number | null = null
  let imageSourcePath: string | null = null
  if (type === 'make' && imageFile) {
    const buf = Buffer.from(await imageFile.arrayBuffer())
    if (buf.length === 0) {
      return NextResponse.json({ error: 'Image upload failed' }, { status: 400 })
    }
    const ext = path.extname(imageFile.name) || '.bin'
    const sourceRel = path.join(userId, 'makes', 'raw', `${model.id}-${Date.now()}${ext}`)
    const rel = path.join(userId, 'makes', `${model.id}-${Date.now()}.webp`)
    await saveBuffer(sourceRel, buf)
    imagePath = `/${rel.replace(/\\/g, '/')}`
    imageSourcePath = `/${sourceRel.replace(/\\/g, '/')}`
    imageWidth = null
    imageHeight = null
  }

  const comment = await prisma.modelComment.create({
    data: {
      modelId: model.id,
      userId,
      body: bodyText,
      type,
      imagePath,
      imageStatus: imagePath ? 'processing' : undefined,
      imageSourcePath: imageSourcePath ?? undefined,
      imageWidth,
      imageHeight,
    },
    include: { user: { select: commentUserSelect } },
  })

  const isVerified = await userHasModelReceipt(model.id, userId)

  try {
    revalidatePath(`/models/${model.id}`)
    revalidateTag(modelTag(model.id), 'max')
    revalidateTag(modelCommentsTag(model.id), 'max')
    revalidateTag(CACHE_TAGS.discoverModels, 'max')
    revalidateTag(CACHE_TAGS.homePage, 'max')
    revalidateTag(CACHE_TAGS.homeCuratedComments, 'max')
  } catch {
    // ignore cache errors
  }

  return NextResponse.json({
    comment: serializeComment({
      ...comment,
      isVerified,
    }),
  })
}
