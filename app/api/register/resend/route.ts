import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createEmailVerificationToken, buildVerificationUrl, sendVerificationEmail } from '@/lib/emailVerification'
import { consumeRateLimit, getAuthRateLimitConfig, getRequestIp } from '@/lib/rate-limit'

const schema = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  try {
    const { email } = schema.parse(await req.json())
    const normalized = email.trim().toLowerCase()
    const ip = getRequestIp(req)
    const rateKey = `resend:${normalized}:${ip}`
    const resendConfig = getAuthRateLimitConfig('resend')
    const resendLimit = await consumeRateLimit(rateKey, resendConfig)
    if (!resendLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many verification resend attempts. Try again later.' },
        { status: 429, headers: resendLimit.retryAfterSeconds ? { 'Retry-After': String(resendLimit.retryAfterSeconds) } : {} },
      )
    }
    const user = await prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, name: true, emailVerified: true, isSuspended: true },
    })

    if (user && !user.emailVerified && !user.isSuspended) {
      await prisma.verificationToken.deleteMany({ where: { userId: user.id } })
      const token = await createEmailVerificationToken(user.id, normalized)
      const verifyUrl = buildVerificationUrl(token)
      try {
        await sendVerificationEmail(normalized, verifyUrl, { reason: 'register', userName: user.name || undefined })
      } catch (mailErr) {
        console.error('Verification email resend failed:', mailErr)
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'If that email is eligible, you will receive a verification email shortly.',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
