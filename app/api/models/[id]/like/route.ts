import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { refreshUserAchievements } from '@/lib/achievements'
import { getUserIdFromCookie } from '@/lib/auth'
import { isSameOriginRequest } from '@/lib/csrf'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS, modelTag } from '@/lib/cache-policy'

type ModelLikeContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: ModelLikeContext) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'Invalid CSRF origin' }, { status: 403 })
  }
  const { id: modelId } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const existing = await prisma.like.findUnique({ where: { userId_modelId: { userId, modelId } } })
  if (existing) {
    await prisma.$transaction([
      prisma.like.delete({ where: { userId_modelId: { userId, modelId } } }),
      prisma.model.update({ where: { id: modelId }, data: { likes: { decrement: 1 } } })
    ])
    const updated = await prisma.model.findUnique({ where: { id: modelId }, select: { likes: true } })
    try {
      revalidateTag(modelTag(modelId), 'max')
      revalidateTag(CACHE_TAGS.discoverModels, 'max')
      revalidateTag(CACHE_TAGS.featuredModels, 'max')
    } catch {}
    const prefersHtml = (req.headers.get('accept') || '').includes('text/html')
    if (prefersHtml) return NextResponse.redirect(new URL(`/models/${modelId}`, req.url), { status: 303 })
    return NextResponse.json({ liked: false, likes: updated?.likes || 0 })
  }
  await prisma.$transaction([
    prisma.like.create({ data: { userId, modelId } }),
    prisma.model.update({ where: { id: modelId }, data: { likes: { increment: 1 } } })
  ])
  try {
    const m = await prisma.model.findUnique({ where: { id: modelId }, select: { userId: true } })
    if (m?.userId) await refreshUserAchievements(prisma, m.userId)
  } catch {}
  const updated = await prisma.model.findUnique({ where: { id: modelId }, select: { likes: true } })
  try {
    revalidateTag(modelTag(modelId), 'max')
    revalidateTag(CACHE_TAGS.discoverModels, 'max')
    revalidateTag(CACHE_TAGS.featuredModels, 'max')
  } catch {}
  const prefersHtml = (req.headers.get('accept') || '').includes('text/html')
  if (prefersHtml) return NextResponse.redirect(new URL(`/models/${modelId}`, req.url), { status: 303 })
  return NextResponse.json({ liked: true, likes: updated?.likes || 0 })
}
