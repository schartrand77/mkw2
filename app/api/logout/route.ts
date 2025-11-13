import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { clearAuthCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const prefersHtml = (req.headers.get('accept') || '').includes('text/html')
  const redirectUrl = new URL('/signed-out', req.url)
  const response = prefersHtml
    ? NextResponse.redirect(redirectUrl, { status: 303 })
    : NextResponse.json({ ok: true, redirect: '/signed-out' })
  clearAuthCookie(response.cookies as any)
  return response
}
