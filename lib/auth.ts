import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/db'

const COOKIE_NAME = 'mwv2_token'

type CookieStore = {
  set: (name: string, value: string, options?: Record<string, any>) => void
  get?: (name: string) => { value?: string } | undefined
}

type CookieOptions = {
  secureHint?: boolean
}

async function resolveCookieStore(store?: CookieStore): Promise<CookieStore> {
  if (store) return store
  return (await cookies()) as unknown as CookieStore
}

async function inferSecureFromHeaders(): Promise<boolean | undefined> {
  try {
    const hdrs = await headers()
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

async function resolveSecureHint(hint?: boolean) {
  const forwarded = await inferSecureFromHeaders()
  if (typeof forwarded === 'boolean') return forwarded
  if (typeof hint === 'boolean') return hint
  return undefined
}

async function shouldUseSecureCookies(hint?: boolean) {
  const resolvedHint = await resolveSecureHint(hint)
  const cookieSecureEnv = (process.env.COOKIE_SECURE || '').toLowerCase()
  if (cookieSecureEnv === 'true') {
    if (resolvedHint === false) {
      // Avoid forcing secure cookies when the current request is definitely HTTP (common during local testing)
      return false
    }
    return true
  }
  if (cookieSecureEnv === 'false') return false
  if (typeof resolvedHint === 'boolean') return resolvedHint
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

type InviteTokenPayload = { sub: string; purpose: 'invite_login' }

export function signInviteToken(userId: string) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not set')
  const hours = Number.parseInt(process.env.INVITE_LOGIN_TOKEN_TTL_HOURS || '24', 10)
  const ttlHours = Number.isFinite(hours) && hours > 0 ? hours : 24
  const expiresIn = ttlHours * 60 * 60
  return jwt.sign({ sub: userId, purpose: 'invite_login' }, secret, { expiresIn })
}

export function verifyInviteToken(token: string): InviteTokenPayload | null {
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET not set')
    const payload = jwt.verify(token, secret) as InviteTokenPayload
    if (!payload?.sub || payload.purpose !== 'invite_login') return null
    return payload
  } catch {
    return null
  }
}

export async function getUserIdFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    const payload = verifyToken(token)
    if (!payload?.sub) return null
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, isSuspended: true } })
    if (!user || user.isSuspended) {
      await clearAuthCookie(cookieStore as any)
      return null
    }
    return user.id
  } catch {
    return null
  }
}

export async function setAuthCookie(userId: string, store?: CookieStore, options?: CookieOptions) {
  const token = signToken(userId)
  const c = await resolveCookieStore(store)
  const secure = await shouldUseSecureCookies(options?.secureHint)
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function clearAuthCookie(store?: CookieStore, options?: CookieOptions) {
  const c = await resolveCookieStore(store)
  const secure = await shouldUseSecureCookies(options?.secureHint)
  c.set(COOKIE_NAME, '', {
    maxAge: 0,
    path: '/',
    secure,
    httpOnly: true,
    sameSite: 'lax',
    expires: new Date(0),
  })
}
