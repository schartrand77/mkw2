import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { ensureUserPage } from '@/lib/userpage'
import { createEmailVerificationToken, buildVerificationUrl, sendVerificationEmail } from '@/lib/emailVerification'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const { email, name, password, confirmPassword } = schema.parse(json)
    const normalizedEmail = email.trim().toLowerCase()
    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords must match' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || null,
        passwordHash,
        isAdmin: false,
        emailVerified: false,
        isSuspended: false,
      },
    })
    await ensureUserPage(user.id, user.email, user.name)
    const token = await createEmailVerificationToken(user.id, normalizedEmail)
    const verifyUrl = buildVerificationUrl(token)
    await sendVerificationEmail(normalizedEmail, verifyUrl, { reason: 'register', userName: user.name || undefined })
    return NextResponse.json({
      ok: true,
      message: 'Verification email sent. Please confirm to finish signing up.',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
