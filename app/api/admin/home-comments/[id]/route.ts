import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { unlink } from 'fs/promises'
import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { storageRoot } from '@/lib/storage'
import { requireAdmin } from '../../_utils'
import { CACHE_TAGS, modelCommentsTag, modelTag } from '@/lib/cache-policy'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const { id } = await params
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body?.isHomeCurated !== 'boolean') {
    return NextResponse.json({ error: 'isHomeCurated must be boolean' }, { status: 400 })
  }

  const existing = await prisma.modelComment.findUnique({
    where: { id },
    select: { id: true, modelId: true },
  })
  if (!existing) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

  await prisma.modelComment.update({
    where: { id: existing.id },
    data: { isHomeCurated: body.isHomeCurated } as any,
  } as any)

  try {
    revalidatePath('/')
    revalidatePath('/admin/home-comments')
    revalidatePath(`/models/${existing.modelId}`)
    revalidateTag(modelTag(existing.modelId), 'max')
    revalidateTag(modelCommentsTag(existing.modelId), 'max')
    revalidateTag(CACHE_TAGS.homePage, 'max')
    revalidateTag(CACHE_TAGS.homeCuratedComments, 'max')
  } catch {
    // ignore cache revalidation failures
  }

  return NextResponse.json({ comment: { id: existing.id, isHomeCurated: body.isHomeCurated } })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const { id } = await params
  const existing = await prisma.modelComment.findUnique({
    where: { id },
    select: { id: true, modelId: true, imagePath: true },
  })
  if (!existing) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

  await prisma.modelComment.delete({ where: { id: existing.id } })
  if (existing.imagePath) {
    try {
      await unlink(path.join(storageRoot(), existing.imagePath.replace(/^\/+/, '')))
    } catch {
      // best-effort file cleanup
    }
  }

  try {
    revalidatePath('/')
    revalidatePath('/admin/home-comments')
    revalidatePath(`/models/${existing.modelId}`)
    revalidateTag(modelTag(existing.modelId), 'max')
    revalidateTag(modelCommentsTag(existing.modelId), 'max')
    revalidateTag(CACHE_TAGS.homePage, 'max')
    revalidateTag(CACHE_TAGS.homeCuratedComments, 'max')
  } catch {
    // ignore cache revalidation failures
  }

  return NextResponse.json({ ok: true })
}
