import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { hashPassword, signInviteToken } from '@/lib/auth'
import { ensureUserPage } from '@/lib/userpage'

type InviteInput = {
  email: string
  name?: string | null
  password?: string
  registrationSource?: string | null
  registrationIp?: string | null
  registrationUserAgent?: string | null
}

export async function createInviteAccount(input: InviteInput) {
  const normalizedEmail = input.email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })
  if (existing) {
    const err = new Error('Email already registered')
    ;(err as any).status = 409
    throw err
  }
  const password = input.password || randomBytes(24).toString('hex')
  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: input.name?.trim() || null,
      passwordHash,
      registrationSource: (input.registrationSource || 'admin_invite').trim().slice(0, 60),
      registrationIp: input.registrationIp?.trim() || null,
      registrationUserAgent: input.registrationUserAgent?.trim().slice(0, 512) || null,
      isAdmin: false,
      emailVerified: true,
      isSuspended: false,
    },
    select: { id: true, email: true, name: true },
  })
  const profile = await ensureUserPage(user.id, user.email, user.name)
  return { user, profile }
}

export function buildInviteLoginUrl(userId: string, baseUrlOverride?: string | null) {
  const token = signInviteToken(userId)
  const fallbackBaseUrl = (process.env.BASE_URL || 'http://localhost:3000').trim()
  const baseUrl = (baseUrlOverride?.trim() || fallbackBaseUrl).replace(/\/+$/, '')
  const loginUrl = `${baseUrl}/api/invite/accept?token=${encodeURIComponent(token)}`
  return { token, loginUrl }
}
