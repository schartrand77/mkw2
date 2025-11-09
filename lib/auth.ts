import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'mwv2_token'

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

export function getUserIdFromCookie(): string | null {
  try {
    const token = cookies().get(COOKIE_NAME)?.value
    if (!token) return null
    const payload = verifyToken(token)
    return payload?.sub || null
  } catch {
    return null
  }
}

export function setAuthCookie(userId: string) {
  const token = signToken(userId)
  const c = cookies()
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}

export function clearAuthCookie() {
  const c = cookies()
  c.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
}

