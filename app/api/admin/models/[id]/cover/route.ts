import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../_utils'
import { prisma } from '@/lib/db'
import path from 'path'
import { readFile, writeFile } from 'fs/promises'
import sharp from 'sharp'
import { storageRoot } from '@/lib/storage'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

function parseDirection(value: unknown) {
  if (typeof value !== 'string') return null
  const dir = value.toLowerCase()
  if (dir === 'left' || dir === 'ccw' || dir === 'counterclockwise') return 'left'
  if (dir === 'right' || dir === 'cw' || dir === 'clockwise') return 'right'
  return null
}

function normalizeTurns(value: number) {
  if (!Number.isFinite(value)) return 0
  const steps = Math.round(value)
  if (steps === 0) return 0
  const mod = ((steps % 4) + 4) % 4
  return mod > 2 ? mod - 4 : mod
}

function extractTurns(body: any, dir: 'left' | 'right' | null) {
  if (typeof body?.rotateTurns === 'number' && Number.isFinite(body.rotateTurns)) {
    const turns = normalizeTurns(body.rotateTurns)
    if (turns !== 0) return turns
  }
  if (dir) return dir === 'left' ? -1 : 1
  return 0
}

function revalidateModelPaths(id: string) {
  try {
    revalidatePath('/')
    revalidatePath('/discover')
    revalidatePath(`/models/${id}`)
  } catch {
    // ignore
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await requireAdmin()
  const model = await prisma.model.findUnique({ where: { id: params.id }, select: { id: true, coverImagePath: true } })
  if (!model) return NextResponse.json({ error: 'Model not found' }, { status: 404 })
  if (!model.coverImagePath) return NextResponse.json({ error: 'Cover image missing' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const direction = parseDirection(body.rotate)
  const turns = extractTurns(body, direction)
  if (!turns) return NextResponse.json({ error: 'Invalid rotate direction' }, { status: 400 })

  const abs = path.join(storageRoot(), model.coverImagePath.replace(/^\/+/, ''))
  try {
    const buf = await readFile(abs)
    const rotated = await sharp(buf).rotate(turns * 90).toBuffer()
    await writeFile(abs, rotated)
  } catch (err) {
    console.error('Failed to rotate cover image (admin)', err)
    return NextResponse.json({ error: 'Failed to rotate cover image' }, { status: 500 })
  }
  await prisma.model.update({ where: { id: params.id }, data: { coverImagePath: model.coverImagePath } })
  revalidateModelPaths(params.id)
  return NextResponse.json({ ok: true })
}
