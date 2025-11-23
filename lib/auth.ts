import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/db'

const COOKIE_NAME = 'mwv2_token'

type CookieStore = {
  set: (name: string, value: string, options?: Record<string, any>) => void
}

type CookieOptions = {
  secureHint?: boolean
}

function resolveCookieStore(store?: CookieStore): CookieStore {
  return (store ?? (cookies() as unknown as CookieStore))
}

function inferSecureFromHeaders(): boolean | undefined {
  try {
    const hdrs = headers()
    const forwardedProto = hdrs.get('x-forwarded-proto')
    if (forwardedProto) {
      const first = forwardedProto.split(',')[0]?.trim()
      if (first) return first === 'https'
    }
    const forwarded = hdrs.get('forwarded')
    if (forwarded) {
      const match = forwarded.match(/proto=(https?)/i)
      if (match?.[1]) return match[1].toLowerCase() === 'https'
    }
  } catch {
    // headers() throws outside of request handling; ignore and fall back to env hints
  }
  return undefined
}

function shouldUseSecureCookies(hint?: boolean) {
  const cookieSecureEnv = (process.env.COOKIE_SECURE || '').toLowerCase()
  if (cookieSecureEnv === 'true') return true
  if (cookieSecureEnv === 'false') return false
  if (typeof hint === 'boolean') return hint
  const base = (process.env.BASE_URL || '').toLowerCase()
  if (base.startsWith('https://')) return true
  return false
}

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export function signToken(userId: string) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not set')
  return jwt.sign({ sub: userId }, secret, { expiresIn: '30d' })
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET not set')
    return jwt.verify(token, secret) as any
  } catch {
    return null
  }
}

export async function getUserIdFromCookie(): Promise<string | null> {
  try {
    const token = cookies().get(COOKIE_NAME)?.value
    if (!token) return null
    const payload = verifyToken(token)
    if (!payload?.sub) return null
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, isSuspended: true } })
    if (!user || user.isSuspended) {
      clearAuthCookie()
      return null
    }
    return user.id
  } catch {
    return null
  }
}

export function setAuthCookie(userId: string, store?: CookieStore, options?: CookieOptions) {
  const token = signToken(userId)
  const c = resolveCookieStore(store)
  const secure = shouldUseSecureCookies(options?.secureHint ?? inferSecureFromHeaders())
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}

export function clearAuthCookie(store?: CookieStore, options?: CookieOptions) {
  const c = resolveCookieStore(store)
  const secure = shouldUseSecureCookies(options?.secureHint ?? inferSecureFromHeaders())
  c.set(COOKIE_NAME, '', {
    maxAge: 0,
    path: '/',
    secure,
    httpOnly: true,
    sameSite: 'lax',
    expires: new Date(0),
  })
}
