import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
export const dynamic = 'force-dynamic'
import { getUserIdFromCookie } from '@/lib/auth'
import { saveBuffer, storageRoot } from '@/lib/storage'
import path from 'path'
import { unlink } from 'fs/promises'
import sharp from 'sharp'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const model = await prisma.model.findUnique({
    where: { id: params.id },
    include: {
      modelTags: { include: { tag: true } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
  })
  const parts = await prisma.modelPart.findMany({ where: { modelId: params.id }, orderBy: { index: 'asc' } })
  if (!model) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const tags = model.modelTags.map(mt => ({ id: mt.tag.id, name: mt.tag.name, slug: mt.tag.slug }))
  const { modelTags, images, ...rest } = model as any
  return NextResponse.json({ model: { ...rest, tags, parts, images } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.model.findUnique({ where: { id: params.id }, select: { userId: true, coverImagePath: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Allow owner or admin
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  if (existing.userId !== userId && !me?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ct = req.headers.get('content-type') || ''
  let title: string | undefined
  let description: string | undefined
  let material: string | undefined
  let removeCover = false
  let image: File | null = null

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData()
    title = (form.get('title') as string | null) || undefined
    description = (form.get('description') as string | null) || undefined
    material = (form.get('material') as string | null) || undefined
    const rc = (form.get('removeCover') as string | null) || 'false'
    removeCover = rc === '1' || rc === 'true'
    image = (form.get('cover') as File | null) || null
  } else {
    try {
      const json = await req.json()
      title = typeof json.title === 'string' ? json.title : undefined
      description = typeof json.description === 'string' ? json.description : undefined
      material = typeof json.material === 'string' ? json.material : undefined
      removeCover = json.removeCover === true
    } catch {
      // ignore
    }
  }

  const updates: any = {}
  if (title != null) updates.title = String(title).slice(0, 200)
  if (description != null) updates.description = String(description).slice(0, 5000)
  if (material != null) updates.material = String(material).slice(0, 40)

  if (removeCover && existing.coverImagePath) {
    try { await unlink(path.join(storageRoot(), existing.coverImagePath.replace(/^\/+/, ''))) } catch {}
    updates.coverImagePath = null
  }

  if (image) {
    const buf = Buffer.from(await image.arrayBuffer())
    // Process to reasonable size webp
    const out = await sharp(buf).resize(1600, 1200, { fit: 'inside' }).webp({ quality: 88 }).toBuffer()
    // Save cover under userId/thumbnails
    const rel = path.join(userId, 'thumbnails', `${Date.now()}-cover.webp`)
    if (existing.coverImagePath) {
      try { await unlink(path.join(storageRoot(), existing.coverImagePath.replace(/^\/+/, ''))) } catch {}
    }
    await saveBuffer(rel, out)
    updates.coverImagePath = `/${rel.replace(/\\/g, '/')}`
  }

  const updated = await prisma.model.update({ where: { id: params.id }, data: updates })
  return NextResponse.json({ model: updated })
}
