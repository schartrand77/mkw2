import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { clearAuthCookie } from '@/lib/auth'
import { isSameOriginRequest } from '@/lib/csrf'

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'Invalid CSRF origin' }, { status: 403 })
  }
  const prefersHtml = (req.headers.get('accept') || '').includes('text/html')
  const redirectUrl = new URL('/signed-out', req.url)
  const response = prefersHtml
    ? NextResponse.redirect(redirectUrl, { status: 303 })
    : NextResponse.json({ ok: true, redirect: '/signed-out' })
  const secureHint = req.nextUrl.protocol === 'https:'
  await clearAuthCookie(response.cookies as any, { secureHint })
  return response
}
