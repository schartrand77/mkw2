import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { slugify } from '@/lib/userpage'
import { normalizeAmazonAffiliateUrl } from '@/lib/amazon'
import { extractYouTubeId } from '@/lib/youtube'
export const dynamic = 'force-dynamic'

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
