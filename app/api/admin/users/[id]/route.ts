import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../_utils'
import { z } from 'zod'
import { ensureUserPage, slugify } from '@/lib/userpage'
import { hashPassword } from '@/lib/auth'
import { saveBuffer, storageRoot } from '@/lib/storage'
import { isSupportedImageFile } from '@/lib/images'
import { unlink } from 'fs/promises'
import path from 'path'
import { enqueueImageProcessing } from '@/lib/processing-jobs'
import { getAdminAuditRequestMeta, recordAdminAuditEvent } from '@/lib/admin-audit'

const patchSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional().nullable(),
  password: z.string().min(6).optional(),
  isAdmin: z.boolean().optional(),
  role: z.enum(['admin', 'staff', 'customer']).optional(),
  suspended: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  slug: z.string().optional(),
  bio: z.string().optional(),
  contactEmail: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  socialTwitter: z.string().optional().nullable(),
  socialInstagram: z.string().optional().nullable(),
  socialTikTok: z.string().optional().nullable(),
  socialYoutube: z.string().optional().nullable(),
  socialBluesky: z.string().optional().nullable(),
  socialFacebook: z.string().optional().nullable(),
  shippingName: z.string().optional().nullable(),
  shippingAddress1: z.string().optional().nullable(),
  shippingAddress2: z.string().optional().nullable(),
  shippingCity: z.string().optional().nullable(),
  shippingState: z.string().optional().nullable(),
  shippingPostal: z.string().optional().nullable(),
  shippingCountry: z.string().optional().nullable(),
})

type AdminUserContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: AdminUserContext) {
  const { id: userId } = await params
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isAdmin: true, role: true, isSuspended: true, emailVerified: true, createdAt: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const profile = await ensureUserPage(userId, user.email, user.name)
    return NextResponse.json({ user, profile })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load user' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, { params }: AdminUserContext) {
  const { id: userId } = await params
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const actor = await prisma.user.findUnique({ where: { id: adminId }, select: { isAdmin: true, role: true } })
    const actorIsAdmin = !!(actor?.isAdmin || actor?.role === 'admin')
    const ct = req.headers.get('content-type') || ''
    let payload: z.infer<typeof patchSchema>
    let avatarFile: File | null = null

    if (ct.includes('multipart/form-data')) {
      const form = await req.formData()
      const readString = (key: string) => {
        const val = form.get(key)
        if (typeof val !== 'string') return undefined
        return val
      }
      const readBool = (key: string) => {
        const val = readString(key)
        if (val === undefined) return undefined
        if (val === 'true') return true
        if (val === 'false') return false
        return undefined
      }
      const emailRaw = readString('email')
      const nameRaw = readString('name')
      const passwordRaw = readString('password')
      const slugRaw = readString('slug')
      const bioRaw = readString('bio')

      const normalizeOptional = (value?: string) => value === undefined ? undefined : (value.trim() ? value : null)
      const formPayload: any = {
        email: emailRaw?.trim() ? emailRaw.trim() : undefined,
        name: nameRaw !== undefined ? (nameRaw.trim() ? nameRaw : null) : undefined,
        password: passwordRaw?.trim() ? passwordRaw : undefined,
        isAdmin: readBool('isAdmin'),
        role: readString('role') || undefined,
        suspended: readBool('suspended'),
        emailVerified: readBool('emailVerified'),
        slug: slugRaw?.trim() ? slugRaw : undefined,
        bio: bioRaw !== undefined ? bioRaw : undefined,
        contactEmail: normalizeOptional(readString('contactEmail')),
        contactPhone: normalizeOptional(readString('contactPhone')),
        websiteUrl: normalizeOptional(readString('websiteUrl')),
        socialTwitter: normalizeOptional(readString('socialTwitter')),
        socialInstagram: normalizeOptional(readString('socialInstagram')),
        socialTikTok: normalizeOptional(readString('socialTikTok')),
        socialYoutube: normalizeOptional(readString('socialYoutube')),
        socialBluesky: normalizeOptional(readString('socialBluesky')),
        socialFacebook: normalizeOptional(readString('socialFacebook')),
        shippingName: normalizeOptional(readString('shippingName')),
        shippingAddress1: normalizeOptional(readString('shippingAddress1')),
        shippingAddress2: normalizeOptional(readString('shippingAddress2')),
        shippingCity: normalizeOptional(readString('shippingCity')),
        shippingState: normalizeOptional(readString('shippingState')),
        shippingPostal: normalizeOptional(readString('shippingPostal')),
        shippingCountry: normalizeOptional(readString('shippingCountry')),
      }
      const avatar = form.get('avatar')
      avatarFile = avatar instanceof File ? avatar : null
      payload = patchSchema.parse(formPayload)
    } else {
      payload = patchSchema.parse(await req.json())
    }
    const hasUpdates = Object.keys(payload).some((key) => (payload as any)[key] !== undefined)
    if (!hasUpdates) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const profileFieldLimits: Record<string, number> = {
      contactEmail: 200,
      contactPhone: 60,
      websiteUrl: 200,
      socialTwitter: 120,
      socialInstagram: 120,
      socialTikTok: 120,
      socialYoutube: 200,
      socialBluesky: 200,
      socialFacebook: 200,
      shippingName: 120,
      shippingAddress1: 200,
      shippingAddress2: 200,
      shippingCity: 120,
      shippingState: 120,
      shippingPostal: 40,
      shippingCountry: 120,
    }

    if ((payload.role || typeof payload.isAdmin === 'boolean') && !actorIsAdmin) {
      return NextResponse.json({ error: 'Only admins can change roles or admin access.' }, { status: 403 })
    }
    if (typeof payload.isAdmin === 'boolean' && userId === adminId && payload.isAdmin === false) {
      return NextResponse.json({ error: 'Cannot remove your own admin access.' }, { status: 400 })
    }
    if (payload.role && userId === adminId && payload.role === 'customer') {
      return NextResponse.json({ error: 'Cannot remove your own admin access.' }, { status: 400 })
    }
    if (typeof payload.suspended === 'boolean' && userId === adminId && payload.suspended === true) {
      return NextResponse.json({ error: 'Cannot suspend your own account.' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true } })
    if (!existingUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const updatesUser: Record<string, any> = {}
    const updatesProfile: Record<string, any> = {}

    if (typeof payload.email === 'string') {
      const normalizedEmail = payload.email.trim().toLowerCase()
      if (normalizedEmail && normalizedEmail !== existingUser.email) {
        const taken = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })
        if (taken && taken.id !== userId) {
          return NextResponse.json({ error: 'Email already in use.' }, { status: 409 })
        }
        updatesUser.email = normalizedEmail
      }
    }
    if (payload.name === null) {
      updatesUser.name = null
    } else if (typeof payload.name === 'string') {
      const trimmedName = payload.name.trim()
      updatesUser.name = trimmedName ? trimmedName.slice(0, 100) : null
    }
    if (typeof payload.password === 'string') updatesUser.passwordHash = await hashPassword(payload.password)
    if (payload.role) {
      updatesUser.role = payload.role
      updatesUser.isAdmin = payload.role === 'admin'
    } else if (typeof payload.isAdmin === 'boolean') {
      updatesUser.isAdmin = payload.isAdmin
      updatesUser.role = payload.isAdmin ? 'admin' : (existingUser.role === 'admin' ? 'customer' : existingUser.role)
    }
    if (typeof payload.suspended === 'boolean') updatesUser.isSuspended = payload.suspended
    if (typeof payload.emailVerified === 'boolean') updatesUser.emailVerified = payload.emailVerified

    const currentProfile = await ensureUserPage(userId, existingUser.email, existingUser.name)

    if (typeof payload.bio === 'string') {
      const trimmedBio = payload.bio.trim()
      updatesProfile.bio = trimmedBio ? trimmedBio.slice(0, 2000) : null
    }
    if (typeof payload.slug === 'string') {
      const clean = slugify(payload.slug).slice(0, 60)
      if (!clean) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
      if (clean !== currentProfile.slug) {
        const taken = await prisma.profile.findUnique({ where: { slug: clean }, select: { userId: true } })
        if (taken && taken.userId !== userId) {
          return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
        }
        updatesProfile.slug = clean
      }
    }

    for (const [key, limit] of Object.entries(profileFieldLimits)) {
      if (!(key in payload)) continue
      const raw = (payload as any)[key]
      if (raw === undefined) continue
      const trimmed = (raw || '').trim()
      updatesProfile[key] = trimmed ? trimmed.slice(0, limit) : null
    }

    let avatarQueued = false
    if (avatarFile) {
      if (!isSupportedImageFile(avatarFile.name, avatarFile.type)) {
        return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
      }
      const buf = Buffer.from(await avatarFile.arrayBuffer())
      if (buf.length === 0) {
        return NextResponse.json({ error: 'Image upload failed' }, { status: 400 })
      }
      if (currentProfile.avatarImagePath) {
        try {
          await unlink(path.join(storageRoot(), currentProfile.avatarImagePath.replace(/^\//, '')))
        } catch {}
      }
      const rel = path.join(userId, 'avatars', `${Date.now()}.webp`)
      const ext = path.extname(avatarFile.name) || '.bin'
      const sourceRel = path.join(userId, 'avatars', 'raw', `${Date.now()}${ext}`)
      await saveBuffer(sourceRel, buf)
      updatesProfile.avatarImagePath = `/${rel.replace(/\\/g, '/')}`
      updatesProfile.avatarImageStatus = 'processing'
      updatesProfile.avatarImageSourcePath = `/${sourceRel.replace(/\\/g, '/')}`
      avatarQueued = true
    }

    if (Object.keys(updatesUser).length === 0 && Object.keys(updatesProfile).length === 0) {
      return NextResponse.json({ user: existingUser, profile: currentProfile })
    }

    const [user, profile] = await prisma.$transaction([
      Object.keys(updatesUser).length
        ? prisma.user.update({
          where: { id: userId },
          data: updatesUser,
          select: { id: true, email: true, name: true, isAdmin: true, role: true, isSuspended: true, emailVerified: true },
        })
        : prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, name: true, isAdmin: true, role: true, isSuspended: true, emailVerified: true },
        }) as any,
      Object.keys(updatesProfile).length
        ? prisma.profile.update({ where: { userId }, data: updatesProfile })
        : prisma.profile.findUnique({ where: { userId } }) as any,
    ])

    if (avatarQueued) {
      try {
        await enqueueImageProcessing({
          includeAvatars: true,
          includeComments: false,
          limit: 1,
          idempotencyKey: `image:avatar:${userId}`,
        })
      } catch {}
    }
    const requestMeta = getAdminAuditRequestMeta(req)
    await recordAdminAuditEvent({
      adminId,
      action: 'admin.user.update',
      targetType: 'user',
      targetId: userId,
      requestMethod: requestMeta.requestMethod,
      requestPath: requestMeta.requestPath,
      requestIp: requestMeta.requestIp,
      userAgent: requestMeta.userAgent,
      metadata: {
        updatedUserKeys: Object.keys(updatesUser),
        updatedProfileKeys: Object.keys(updatesProfile),
      } as any,
    })

    return NextResponse.json({ user, profile })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: AdminUserContext) {
  const { id: userId } = await params
  let adminId = ''
  try { adminId = await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  try {
    const actor = await prisma.user.findUnique({ where: { id: adminId }, select: { isAdmin: true, role: true } })
    const actorIsAdmin = !!(actor?.isAdmin || actor?.role === 'admin')
    if (!actorIsAdmin) return NextResponse.json({ error: 'Only admins can delete users.' }, { status: 403 })
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isAdmin: true, role: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (user.isAdmin || user.role === 'admin') return NextResponse.json({ error: 'Cannot delete admin accounts' }, { status: 403 })

    await prisma.$transaction([
      prisma.like.deleteMany({ where: { OR: [{ userId }, { model: { userId } }] } }),
      prisma.modelTag.deleteMany({ where: { model: { userId } } }),
      prisma.model.deleteMany({ where: { userId } }),
      prisma.profile.deleteMany({ where: { userId } }),
      prisma.verificationToken.deleteMany({ where: { userId } }),
      prisma.userAchievement.deleteMany({ where: { userId } }),
      prisma.jobForm.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ])
    const requestMeta = getAdminAuditRequestMeta(req)
    await recordAdminAuditEvent({
      adminId,
      action: 'admin.user.delete',
      targetType: 'user',
      targetId: userId,
      requestMethod: requestMeta.requestMethod,
      requestPath: requestMeta.requestPath,
      requestIp: requestMeta.requestIp,
      userAgent: requestMeta.userAgent,
      metadata: { deletedBy: adminId } as any,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete user' }, { status: 400 })
  }
}
