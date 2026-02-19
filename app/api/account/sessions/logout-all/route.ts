import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'
import { clearAuthCookie, getUserIdFromCookie } from '@/lib/auth'
import { isSameOriginRequest } from '@/lib/csrf'

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: 'Invalid CSRF origin' }, { status: 403 })

  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  })

  const prefersHtml = (req.headers.get('accept') || '').includes('text/html')
  const redirectUrl = new URL('/signed-out', req.url)
  const response = prefersHtml
    ? NextResponse.redirect(redirectUrl, { status: 303 })
    : NextResponse.json({ ok: true, requiresReauth: true, redirect: '/signed-out' })

  const secureHint = req.nextUrl.protocol === 'https:'
  await clearAuthCookie(response.cookies as any, { secureHint })
  return response
}
