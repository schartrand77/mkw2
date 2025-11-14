import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { saveBuffer } from '@/lib/storage'
import { refreshUserAchievements } from '@/lib/achievements'
import sharp from 'sharp'
import { unlink } from 'fs/promises'
import path from 'path'
import { ensureUserPage, slugify } from '@/lib/userpage'
import { isSupportedImageFile } from '@/lib/images'

export async function GET() {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await ensureUserPage(userId)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } })
  return NextResponse.json({ profile, user })
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ct = req.headers.get('content-type') || ''
  let name: string | undefined
  let bio: string | undefined
  let slug: string | undefined
  let avatarFile: File | null = null
  const extraFields: Record<string, string | null | undefined> = {}

  const profileFieldLimits: Record<string, number> = {
    contactEmail: 200,
    contactPhone: 60,
    websiteUrl: 200,
    socialTwitter: 120,
    socialInstagram: 120,
    socialTikTok: 120,
    socialYoutube: 200,
    socialLinkedin: 200,
    socialFacebook: 200,
    shippingName: 120,
    shippingAddress1: 200,
    shippingAddress2: 200,
    shippingCity: 120,
    shippingState: 120,
    shippingPostal: 40,
    shippingCountry: 120,
  }

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData()
    name = (form.get('name') as string | null) || undefined
    bio = (form.get('bio') as string | null) || undefined
    slug = (form.get('slug') as string | null) || undefined
    avatarFile = (form.get('avatar') as File | null) || null
    for (const key of Object.keys(profileFieldLimits)) {
      if (form.has(key)) {
        extraFields[key] = (form.get(key) as string | null) ?? null
      }
    }
  } else {
    try {
      const json = await req.json()
      name = typeof json.name === 'string' ? json.name : undefined
      bio = typeof json.bio === 'string' ? json.bio : undefined
      slug = typeof json.slug === 'string' ? json.slug : undefined
      for (const key of Object.keys(profileFieldLimits)) {
        if (key in json) {
          extraFields[key] = typeof json[key] === 'string' ? json[key] : null
        }
      }
    } catch {
      // ignore
    }
  }

  const updatesUser: any = {}
  const updatesProfile: any = {}

  if (typeof name === 'string') updatesUser.name = name.slice(0, 100)
  if (typeof bio === 'string') updatesProfile.bio = bio.slice(0, 2000)

  const current = await ensureUserPage(userId)

  if (typeof slug === 'string') {
    const clean = slugify(slug).slice(0, 60)
    if (!clean) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
    if (clean !== current.slug) {
      const taken = await prisma.profile.findUnique({ where: { slug: clean } })
      if (taken) return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
      updatesProfile.slug = clean
    }
  }

  if (avatarFile && isSupportedImageFile(avatarFile.name, avatarFile.type)) {
    const buf = Buffer.from(await avatarFile.arrayBuffer())
    // Process avatar to 512x512 webp, center-crop
    const out = await sharp(buf).rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 90 }).toBuffer()
    // Store avatars under {userId}/avatars/{timestamp}.webp for per-user organization
    const rel = path.join(userId, 'avatars', `${Date.now()}.webp`)
    // Cleanup old avatar if any
    if (current.avatarImagePath) {
      try { await unlink(path.join(process.env.STORAGE_DIR || process.cwd() + '/storage', current.avatarImagePath.replace(/^\//, ''))) } catch {}
    }
    await saveBuffer(rel, out)
    updatesProfile.avatarImagePath = `/${rel.replace(/\\/g, '/')}`
  }

  for (const [key, raw] of Object.entries(extraFields)) {
    if (!(key in profileFieldLimits)) continue
    if (raw === undefined) continue
    const limit = profileFieldLimits[key]
    const trimmed = (raw || '').trim()
    updatesProfile[key] = trimmed ? trimmed.slice(0, limit) : null
  }

  if (Object.keys(updatesUser).length === 0 && Object.keys(updatesProfile).length === 0) {
    // Nothing to update
    const fresh = await prisma.profile.findUnique({ where: { userId } })
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } })
    return NextResponse.json({ profile: fresh, user })
  }

  const [user, profile] = await prisma.$transaction([
    Object.keys(updatesUser).length ? prisma.user.update({ where: { id: userId }, data: updatesUser, select: { id: true, email: true, name: true } }) : prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } }) as any,
    Object.keys(updatesProfile).length ? prisma.profile.update({ where: { userId }, data: updatesProfile }) : prisma.profile.findUnique({ where: { userId } }) as any,
  ])
  try { await refreshUserAchievements(prisma, userId) } catch {}
  return NextResponse.json({ profile, user })
}
