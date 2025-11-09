import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import path from 'path'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { saveBuffer } from '@/lib/storage'
import { computeStlVolumeMm3 } from '@/lib/stl'
import JSZip from 'jszip'
import { estimatePriceUSD } from '@/lib/pricing'

const isAllowedModel = (name: string) => /\.(stl|obj)$/i.test(name)
const isImage = (name: string) => /\.(png|jpe?g|webp)$/i.test(name)

export async function POST(req: NextRequest) {
  try {
    // Check site config for anonymous upload policy
    const { prisma } = await import('@/lib/db')
    const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' } })
    const uidFromCookie = getUserIdFromCookie()
    if (cfg && cfg.allowAnonymousUploads === false && !uidFromCookie) {
      return NextResponse.json({ error: 'Sign in required to upload' }, { status: 401 })
    }
    const userId = uidFromCookie || (await ensureAnonymousUser())

    const form = await req.formData()
    const title = String(form.get('title') || '').slice(0, 200)
    const description = String(form.get('description') || '').slice(0, 2000)
    const material = String(form.get('material') || 'PLA').slice(0, 40)
    const files = form.getAll('files') as File[]
    const model = (form.get('model') as File | null) // legacy single file field
    const tagsRaw = (form.get('tags') as string | null) || ''
    const image = form.get('image') as File | null

    // Collect candidate model files (support zip or multiple file inputs)
    const modelFiles: { name: string, buf: Buffer }[] = []
    const inputs = files && files.length > 0 ? files : (model ? [model] : [])
    if (!inputs || inputs.length === 0) return NextResponse.json({ error: 'Missing model files' }, { status: 400 })

    for (const f of inputs) {
      const lower = f.name.toLowerCase()
      const ab = await f.arrayBuffer()
      const buf = Buffer.from(ab)
      if (lower.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(buf)
        const entries = Object.values(zip.files)
        for (const entry of entries) {
          if (entry.dir) continue
          const ename = entry.name
          if (!isAllowedModel(ename)) continue
          const ebuf = await entry.async('nodebuffer')
          modelFiles.push({ name: path.basename(ename), buf: ebuf })
        }
      } else if (isAllowedModel(lower)) {
        modelFiles.push({ name: f.name, buf })
      }
    }

    if (modelFiles.length === 0) return NextResponse.json({ error: 'No valid model files found' }, { status: 400 })

    let coverImageRel: string | undefined
    if (image && isImage(image.name)) {
      const imgBuf = Buffer.from(await image.arrayBuffer())
      const imgExt = path.extname(image.name).toLowerCase() || '.png'
      coverImageRel = path.join('images', userId, `${Date.now()}-${safeName(title) || 'cover'}${imgExt}`)
      await saveBuffer(coverImageRel, imgBuf)
    }

    // Save files and create model + parts
    const now = Date.now()
    let totalVolMm3 = 0
    let totalPrice = 0
    const partCreates: any[] = []
    let firstPath: string | null = null

    for (let i = 0; i < modelFiles.length; i++) {
      const f = modelFiles[i]
      const ext = path.extname(f.name).toLowerCase()
      const rel = path.join('models', userId, `${now}-${safeName(title) || 'model'}-${i + 1}${ext}`)
      await saveBuffer(rel, f.buf)
      if (!firstPath) firstPath = `/${rel.replace(/\\/g, '/')}`
      let volMm3: number | null = null
      if (ext === '.stl') volMm3 = computeStlVolumeMm3(f.buf)
      const cm3 = volMm3 ? volMm3 / 1000 : null
      const p = cm3 != null ? estimatePriceUSD({ cm3, material, cfg }) : null
      if (volMm3) totalVolMm3 += volMm3
      if (p) totalPrice += p
      partCreates.push({ name: f.name, index: i, filePath: `/${rel.replace(/\\/g, '/')}`, volumeMm3: volMm3 || undefined, priceUsd: p || undefined })
    }

    const created = await prisma.model.create({
      data: {
        userId,
        title,
        description,
        material,
        filePath: firstPath!,
        coverImagePath: coverImageRel ? `/${coverImageRel.replace(/\\/g, '/')}` : undefined,
        fileType: modelFiles.length > 1 ? 'MULTI' : path.extname(modelFiles[0].name).replace('.', '').toUpperCase(),
        volumeMm3: totalVolMm3 || undefined,
        priceUsd: totalPrice || undefined,
        modelTags: tagsRaw ? { create: await prepareTags(tagsRaw) } : undefined,
        parts: { create: partCreates }
      }
    })

    return NextResponse.json({ model: created })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 400 })
  }
}

function safeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function ensureAnonymousUser(): Promise<string> {
  // Create a stable anonymous user to attach uploads when not logged in
  const anonEmail = 'anonymous@local'
  const existing = await prisma.user.findUnique({ where: { email: anonEmail } })
  if (existing) return existing.id
  const created = await prisma.user.create({ data: { email: anonEmail, passwordHash: '!' } })
  return created.id
}

async function prepareTags(tagsRaw: string) {
  const { prisma } = await import('@/lib/db')
  const { slugify } = await import('@/lib/userpage')
  const names = Array.from(new Set(tagsRaw.split(',').map(t => t.trim()).filter(Boolean))).slice(0, 12)
  const result: any[] = []
  for (const name of names) {
    const slug = slugify(name)
    let tag = await prisma.tag.findUnique({ where: { slug } })
    if (!tag) {
      try {
        tag = await prisma.tag.create({ data: { name, slug } })
      } catch {
        tag = await prisma.tag.findUnique({ where: { slug } })
      }
    }
    if (tag) result.push({ tag: { connect: { id: tag.id } } })
  }
  return result
}
