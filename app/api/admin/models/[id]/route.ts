import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { slugify } from '@/lib/userpage'
import { normalizeAmazonAffiliateUrl } from '@/lib/amazon'
import { extractYouTubeId } from '@/lib/youtube'
import { storageRoot } from '@/lib/storage'
import path from 'path'
import { unlink } from 'fs/promises'
export const dynamic = 'force-dynamic'

const SALE_PRICE_UNITS = new Set(['ea', 'bx', 'complete'])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const id = params.id
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const updates: any = {}
  const visibility = body.visibility
  if (visibility != null) {
    const allowed = new Set(['public', 'private', 'unlisted'])
    if (!allowed.has(String(visibility))) return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 })
    updates.visibility = String(visibility)
  }

  if (body.affiliateTitle !== undefined) {
    const raw = String(body.affiliateTitle ?? '').trim()
    updates.affiliateTitle = raw ? raw.slice(0, 160) : null
  }

  if (body.affiliateUrl !== undefined) {
    const raw = String(body.affiliateUrl ?? '').trim()
    if (!raw) {
      updates.affiliateUrl = null
    } else {
      const normalized = normalizeAmazonAffiliateUrl(raw)
      if (!normalized) return NextResponse.json({ error: 'Affiliate link must be an Amazon URL' }, { status: 400 })
      updates.affiliateUrl = normalized
    }
  }

  if (body.videoUrl !== undefined) {
    const raw = String(body.videoUrl ?? '').trim()
    if (!raw) {
      updates.videoEmbedId = null
    } else {
      const id = extractYouTubeId(raw)
      if (!id) return NextResponse.json({ error: 'Video must be a valid YouTube link or ID' }, { status: 400 })
      updates.videoEmbedId = id
    }
  }

  const tagsInput: string[] | string | undefined = body.tags
  if (body.salePriceUsd !== undefined) {
    const raw = Number(body.salePriceUsd)
    if (body.salePriceUsd === null || !Number.isFinite(raw) || raw <= 0) {
      updates.salePriceUsd = null
    } else {
      updates.salePriceUsd = raw
    }
  }

  if (body.salePriceIsFrom !== undefined) {
    updates.salePriceIsFrom = Boolean(body.salePriceIsFrom)
  }

  if (body.salePriceUnit !== undefined) {
    const raw = String(body.salePriceUnit ?? '').trim().toLowerCase()
    if (!raw) {
      updates.salePriceUnit = null
    } else if (!SALE_PRICE_UNITS.has(raw)) {
      return NextResponse.json({ error: 'Invalid sale price unit' }, { status: 400 })
    } else {
      updates.salePriceUnit = raw
    }
  }

  // Apply updates
  await prisma.model.update({ where: { id }, data: updates })

  if (tagsInput != null) {
    const names = (Array.isArray(tagsInput) ? tagsInput : String(tagsInput).split(',')).map((t) => t.trim()).filter(Boolean)
    const unique = Array.from(new Set(names)).slice(0, 20)
    const tagRecords: { id: string }[] = []
    for (const name of unique) {
      const s = slugify(name)
      let tag = await prisma.tag.findUnique({ where: { slug: s } })
      if (!tag) {
        try { tag = await prisma.tag.create({ data: { name, slug: s } }) } catch { tag = await prisma.tag.findUnique({ where: { slug: s } }) }
      }
      if (tag) tagRecords.push({ id: tag.id })
    }
    await prisma.model.update({
      where: { id },
      data: {
        modelTags: { deleteMany: { modelId: id }, create: tagRecords.map(tr => ({ tag: { connect: { id: tr.id } } })) }
      }
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  const model = await prisma.model.findUnique({
    where: { id: params.id },
    include: { images: true, parts: true },
  })
  if (!model) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const files: Array<string | null | undefined> = [
    model.filePath,
    model.coverImagePath,
    ...model.images.map(img => img.filePath),
    ...model.parts.map(part => part.filePath),
  ]

  await prisma.model.delete({ where: { id: model.id } })
  await removeStoredFiles(files)
  return NextResponse.json({ ok: true })
}

async function removeStoredFiles(paths: Array<string | null | undefined>) {
  const unique = new Set<string>()
  for (const candidate of paths) {
    const resolved = resolveStorageFilePath(candidate)
    if (resolved) unique.add(resolved)
  }
  await Promise.all(Array.from(unique).map(async (fullPath) => {
    try { await unlink(fullPath) } catch {}
  }))
}

function resolveStorageFilePath(input: string | null | undefined): string | null {
  if (!input) return null
  let normalized = String(input).trim()
  if (!normalized) return null
  if (/^https?:\/\//i.test(normalized)) return null
  normalized = normalized.replace(/\\/g, '/')
  const root = storageRoot()
  const normalizedRoot = root.replace(/\\/g, '/')
  if (normalized.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
    normalized = normalized.slice(normalizedRoot.length)
  }
  normalized = normalized.replace(/^\/+/, '')
  normalized = normalized.replace(/^(?:[a-z]:)?\/?files\//i, '')
  normalized = normalized.replace(/^(?:[a-z]:)?\/?app\/storage\//i, '')
  normalized = normalized.replace(/^(?:[a-z]:)?\/?storage\//i, '')
  normalized = normalized.replace(/^\/+/, '')
  if (!normalized || path.isAbsolute(normalized) || normalized.includes('..')) return null
  return path.join(root, normalized)
}
