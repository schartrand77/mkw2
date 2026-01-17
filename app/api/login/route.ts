import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { verifyPassword, setAuthCookie } from '@/lib/auth'
import { ensureUserPage } from '@/lib/userpage'
import { checkRateLimit, clearRateLimit, consumeRateLimit, getAuthRateLimitConfig, getRequestIp } from '@/lib/rate-limit'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const { email, password } = schema.parse(json)
    const normalizedEmail = email.trim().toLowerCase()
    const ip = getRequestIp(req)
    const rateKey = `login:${normalizedEmail}:${ip}`
    const loginConfig = getAuthRateLimitConfig('login')
    const loginLimit = await checkRateLimit(rateKey, loginConfig)
    if (!loginLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        { status: 429, headers: loginLimit.retryAfterSeconds ? { 'Retry-After': String(loginLimit.retryAfterSeconds) } : {} },
      )
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user) {
      await consumeRateLimit(rateKey, loginConfig)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    if (user.isSuspended) {
      await consumeRateLimit(rateKey, loginConfig)
      return NextResponse.json({ error: 'Account suspended. Contact support.' }, { status: 403 })
    }
    if (!user.emailVerified) {
      await consumeRateLimit(rateKey, loginConfig)
      return NextResponse.json({ error: 'Please verify your email before signing in.' }, { status: 403 })
    }
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      await consumeRateLimit(rateKey, loginConfig)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    // Ensure the user has a profile page before responding
    await ensureUserPage(user.id, user.email, user.name)
    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, isAdmin: (user as any).isAdmin } })
    const secureHint = req.nextUrl.protocol === 'https:'
    await setAuthCookie(user.id, response.cookies as any, { secureHint })
    await clearRateLimit(rateKey)
    return response
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid request' }, { status: 400 })
  }
}
