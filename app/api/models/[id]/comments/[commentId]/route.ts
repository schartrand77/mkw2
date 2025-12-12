import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { unlink } from 'fs/promises'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { storageRoot } from '@/lib/storage'

export const dynamic = 'force-dynamic'

type ModelCommentDeleteContext = { params: Promise<{ id: string; commentId: string }> }

export async function DELETE(_req: NextRequest, { params }: ModelCommentDeleteContext) {
  const { id, commentId } = await params
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  if (!me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existing = await prisma.modelComment.findUnique({
    where: { id: commentId },
    select: { id: true, modelId: true, imagePath: true },
  })
  if (!existing || existing.modelId !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.modelComment.delete({ where: { id: existing.id } })
  if (existing.imagePath) {
    try {
      await unlink(path.join(storageRoot(), existing.imagePath.replace(/^\/+/, '')))
    } catch {
      // best effort cleanup
    }
  }
  try {
    revalidatePath(`/models/${existing.modelId}`)
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true })
}
