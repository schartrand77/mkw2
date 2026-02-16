import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toPublicHref } from '@/lib/storage'
import { requireAdmin } from '../_utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const mode = (searchParams.get('mode') || 'all').trim().toLowerCase()

  const where: any = {
    type: 'comment',
  }
  if (mode === 'curated') where.isHomeCurated = true
  if (mode === 'uncurated') where.isHomeCurated = false
  if (q) {
    where.OR = [
      { body: { contains: q, mode: 'insensitive' } },
      { model: { title: { contains: q, mode: 'insensitive' } } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
      { user: { profile: { slug: { contains: q, mode: 'insensitive' } } } },
    ]
  }

  const comments = await prisma.modelComment.findMany({
    where,
    orderBy: [{ isHomeCurated: 'desc' }, { createdAt: 'desc' }],
    take: 120,
    include: {
      model: { select: { id: true, title: true, visibility: true } },
      user: {
        select: {
          id: true,
          name: true,
          profile: { select: { slug: true, avatarImagePath: true } },
        },
      },
    },
  } as any) as any[]

  return NextResponse.json({
    comments: comments.map((comment) => {
      const profileSlug = comment.user?.profile?.slug || null
      const displayName = comment.user?.name?.trim() || (profileSlug ? `@${profileSlug}` : 'Community maker')
      return {
        id: comment.id,
        modelId: comment.modelId,
        modelTitle: comment.model?.title || 'Untitled model',
        modelVisibility: comment.model?.visibility || 'public',
        body: comment.body,
        type: comment.type,
        createdAt: comment.createdAt,
        isHomeCurated: Boolean(comment.isHomeCurated),
        user: {
          id: comment.user?.id || null,
          displayName,
          profileSlug,
          avatarUrl: toPublicHref(comment.user?.profile?.avatarImagePath) || null,
        },
      }
    }),
  })
}
