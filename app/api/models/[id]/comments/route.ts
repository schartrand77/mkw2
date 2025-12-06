import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { commentInclude, commentUserSelect, detectCommentViolation, serializeComment } from '@/lib/comments'

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
  return NextResponse.json({ comments: comments.map(serializeComment) })
}

export async function POST(req: NextRequest, { params }: ModelCommentsContext) {
  const { id } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let bodyText = ''
  try {
    const payload = await req.json()
    bodyText = normalizeBody(payload?.body)
  } catch {
    bodyText = ''
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

  const comment = await prisma.modelComment.create({
    data: { modelId: model.id, userId, body: bodyText },
    include: { user: { select: commentUserSelect } },
  })

  try {
    revalidatePath(`/models/${model.id}`)
  } catch {
    // ignore cache errors
  }

  return NextResponse.json({ comment: serializeComment(comment) })
}
