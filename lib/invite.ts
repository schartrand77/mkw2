import { prisma } from '@/lib/db'
import { hashPassword, signInviteToken } from '@/lib/auth'
import { ensureUserPage } from '@/lib/userpage'

type InviteInput = {
  email: string
  name?: string | null
  password: string
}

export async function createInviteAccount(input: InviteInput) {
  const normalizedEmail = input.email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })
  if (existing) {
    const err = new Error('Email already registered')
    ;(err as any).status = 409
    throw err
  }
  const passwordHash = await hashPassword(input.password)
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: input.name?.trim() || null,
      passwordHash,
      isAdmin: false,
      emailVerified: true,
      isSuspended: false,
    },
    select: { id: true, email: true, name: true },
  })
  const profile = await ensureUserPage(user.id, user.email, user.name)
  return { user, profile }
}

export function buildInviteLoginUrl(userId: string) {
  const token = signInviteToken(userId)
  const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
  const loginUrl = `${baseUrl}/api/invite/accept?token=${encodeURIComponent(token)}`
  return { token, loginUrl }
}
