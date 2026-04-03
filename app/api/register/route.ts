import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { ensureUserPage } from '@/lib/userpage'
import { createEmailVerificationToken, buildVerificationUrl, sendVerificationEmail } from '@/lib/emailVerification'
import { sendAdminDiscordNotification } from '@/lib/discord'
import { sendAdminPushNotification } from '@/lib/push'
import { consumeRateLimit, getAuthRateLimitConfig, getRequestIp } from '@/lib/rate-limit'

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
    const ip = getRequestIp(req)
    const userAgent = (req.headers.get('user-agent') || '').trim().slice(0, 512)
    const rateKey = `register:${normalizedEmail}:${ip}`
    const registerConfig = getAuthRateLimitConfig('register')
    const registerLimit = await consumeRateLimit(rateKey, registerConfig)
    if (!registerLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Try again later.' },
        { status: 429, headers: registerLimit.retryAfterSeconds ? { 'Retry-After': String(registerLimit.retryAfterSeconds) } : {} },
      )
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords must match' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, emailVerified: true, isSuspended: true },
    })
    if (existing) {
      if (!existing.isSuspended && !existing.emailVerified) {
        try {
          const token = await createEmailVerificationToken(existing.id, normalizedEmail)
          const verifyUrl = buildVerificationUrl(token)
          await sendVerificationEmail(normalizedEmail, verifyUrl, { reason: 'register', userName: existing.name || undefined })
        } catch (mailErr) {
          console.error('Verification email resend failed:', mailErr)
        }
      }
      return NextResponse.json({
        ok: true,
        message: 'If that email is eligible, you will receive a verification email shortly.',
      })
    }
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || null,
        passwordHash,
        registrationSource: 'self_signup',
        registrationIp: ip || null,
        registrationUserAgent: userAgent || null,
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
    try {
      const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
      const profileUrl = profile?.slug ? `${baseUrl}/u/${profile.slug}` : undefined
      await sendAdminPushNotification({
        title: 'New user registered',
        body: `${normalizedEmail}${user.name ? ` (${user.name})` : ''}`,
        url: profileUrl || `${baseUrl}/admin/users`,
        tag: `user:${user.id}`,
        data: { userId: user.id },
      })
    } catch (notifyErr) {
      console.error('Admin push notification failed for signup:', notifyErr)
    }
    return NextResponse.json({
      ok: true,
      message: 'If that email is eligible, you will receive a verification email shortly.',
      mailError: !emailSent,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
