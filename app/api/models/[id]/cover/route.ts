import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { readFile, writeFile } from 'fs/promises'
import sharp from 'sharp'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { storageRoot } from '@/lib/storage'

export const dynamic = 'force-dynamic'

function parseDirection(value: unknown) {
  if (typeof value !== 'string') return null
  const dir = value.toLowerCase()
  if (dir === 'left' || dir === 'ccw' || dir === 'counterclockwise') return 'left'
  if (dir === 'right' || dir === 'cw' || dir === 'clockwise') return 'right'
  return null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [model, me] = await Promise.all([
    prisma.model.findUnique({ where: { id: params.id }, select: { id: true, userId: true, coverImagePath: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }),
  ])
  if (!model) return NextResponse.json({ error: 'Model not found' }, { status: 404 })
  if (model.userId !== userId && !me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!model.coverImagePath) return NextResponse.json({ error: 'Cover image missing' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const direction = parseDirection(body.rotate)
  if (!direction) return NextResponse.json({ error: 'Invalid rotate direction' }, { status: 400 })

  const abs = path.join(storageRoot(), model.coverImagePath.replace(/^\/+/, ''))
  try {
    const buf = await readFile(abs)
    const rotated = await sharp(buf).rotate(direction === 'left' ? -90 : 90).toBuffer()
    await writeFile(abs, rotated)
  } catch (err) {
    console.error('Failed to rotate cover image', err)
    return NextResponse.json({ error: 'Failed to rotate cover image' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
