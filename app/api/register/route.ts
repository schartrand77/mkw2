import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { ensureUserPage } from '@/lib/userpage'
import { createEmailVerificationToken, buildVerificationUrl, sendVerificationEmail } from '@/lib/emailVerification'
import { sendAdminDiscordNotification } from '@/lib/discord'

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
    const profile = await ensureUserPage(user.id, user.email, user.name)
    const token = await createEmailVerificationToken(user.id, normalizedEmail)
    const verifyUrl = buildVerificationUrl(token)
    let emailSent = false
    try {
      emailSent = await sendVerificationEmail(normalizedEmail, verifyUrl, { reason: 'register', userName: user.name || undefined })
    } catch (mailErr) {
      console.error('Verification email send failed:', mailErr)
    }
    try {
      const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
      const profileUrl = profile?.slug ? `${baseUrl}/u/${profile.slug}` : undefined
      await sendAdminDiscordNotification({
        title: 'New user registered',
        body: [
          `Email: ${normalizedEmail}`,
          user.name ? `Name: ${user.name}` : null,
          profileUrl ? `Profile: ${profileUrl}` : null,
        ],
        meta: {
          id: user.id,
          verification: emailSent ? 'email sent' : 'email pending',
        },
      })
    } catch (notifyErr) {
      console.error('Admin Discord notification failed for signup:', notifyErr)
    }
    return NextResponse.json({
      ok: true,
      message: emailSent
        ? 'Verification email sent. Please confirm to finish signing up.'
        : 'Account created but we could not send the verification email automatically. Use “Resend verification email” once email is configured.',
      mailError: !emailSent,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
