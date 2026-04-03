import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { setAuthCookie, verifyInviteToken } from '@/lib/auth'
import { resolveBaseUrl } from '@/lib/base-url'

export const dynamic = 'force-dynamic'

function isLocalOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
}

export async function GET(req: NextRequest) {
  const requestOrigin = req.nextUrl.origin.replace(/\/+$/, '')
  const resolvedBaseUrl = await resolveBaseUrl()
  const envBaseUrl = (process.env.BASE_URL || '').replace(/\/+$/, '')
  const baseUrl = (resolvedBaseUrl || envBaseUrl || (isLocalOrigin(requestOrigin) ? '' : requestOrigin)).replace(/\/+$/, '')
  const redirectBase = baseUrl || requestOrigin
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!token) {
    return NextResponse.redirect(new URL('/login?invite=missing', redirectBase))
  }
  const payload = verifyInviteToken(token)
  if (!payload?.sub) {
    return NextResponse.redirect(new URL('/login?invite=invalid', redirectBase))
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, isSuspended: true } })
  if (!user || user.isSuspended) {
    return NextResponse.redirect(new URL('/login?invite=invalid', redirectBase))
  }
  const response = NextResponse.redirect(new URL('/me', redirectBase))
  const secureHint = redirectBase.startsWith('https://')
  await setAuthCookie(user.id, response.cookies as any, { secureHint })
  return response
}
