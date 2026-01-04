import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { setAuthCookie, verifyInviteToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!token) {
    return NextResponse.redirect(new URL('/login?invite=missing', req.url))
  }
  const payload = verifyInviteToken(token)
  if (!payload?.sub) {
    return NextResponse.redirect(new URL('/login?invite=invalid', req.url))
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, isSuspended: true } })
  if (!user || user.isSuspended) {
    return NextResponse.redirect(new URL('/login?invite=invalid', req.url))
  }
  const response = NextResponse.redirect(new URL('/me', req.url))
  const secureHint = req.nextUrl.protocol === 'https:'
  await setAuthCookie(user.id, response.cookies as any, { secureHint })
  return response
}
