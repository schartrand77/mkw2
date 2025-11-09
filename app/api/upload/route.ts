import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import path from 'path'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { saveBuffer } from '@/lib/storage'
import { computeStlVolumeMm3 } from '@/lib/stl'

const isAllowedModel = (name: string) => /\.(stl|obj)$/i.test(name)
const isImage = (name: string) => /\.(png|jpe?g|webp)$/i.test(name)

export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromCookie() || (await ensureAnonymousUser())

    const form = await req.formData()
    const title = String(form.get('title') || '').slice(0, 200)
    const description = String(form.get('description') || '').slice(0, 2000)
    const material = String(form.get('material') || 'PLA').slice(0, 40)
    const model = form.get('model') as File | null
    const tagsRaw = (form.get('tags') as string | null) || ''
    const image = form.get('image') as File | null

    if (!model) return NextResponse.json({ error: 'Missing model' }, { status: 400 })
    if (!isAllowedModel(model.name)) return NextResponse.json({ error: 'Unsupported model type' }, { status: 400 })

    const modelBuf = Buffer.from(await model.arrayBuffer())
    const ext = path.extname(model.name).toLowerCase()
    const modelFileRel = path.join('models', userId, `${Date.now()}-${safeName(title) || 'model'}${ext}`)
    await saveBuffer(modelFileRel, modelBuf)

    let coverImageRel: string | undefined
    if (image && isImage(image.name)) {
      const imgBuf = Buffer.from(await image.arrayBuffer())
      const imgExt = path.extname(image.name).toLowerCase() || '.png'
      coverImageRel = path.join('images', userId, `${Date.now()}-${safeName(title) || 'cover'}${imgExt}`)
      await saveBuffer(coverImageRel, imgBuf)
    }

    let volumeMm3: number | null = null
    if (ext === '.stl') {
      volumeMm3 = computeStlVolumeMm3(modelBuf)
    }
    const cm3 = volumeMm3 ? volumeMm3 / 1000 : null
    const costPerCm3 = parseFloat(process.env.COST_PER_CM3 || '0.3')
    const fixedFee = parseFloat(process.env.FIXED_FEE_USD || '1.0')
    const priceUsd = cm3 != null ? Number((cm3 * costPerCm3 + fixedFee).toFixed(2)) : null

    const created = await prisma.model.create({
      data: {
        userId,
        title,
        description,
        material,
        filePath: `/${modelFileRel.replace(/\\/g, '/')}`,
        coverImagePath: coverImageRel ? `/${coverImageRel.replace(/\\/g, '/')}` : undefined,
        fileType: ext.replace('.', '').toUpperCase(),
        volumeMm3: volumeMm3 || undefined,
        priceUsd: priceUsd || undefined,
        modelTags: tagsRaw ? {
          create: await prepareTags(tagsRaw)
        } : undefined,
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
