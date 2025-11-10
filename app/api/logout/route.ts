import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { clearAuthCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  clearAuthCookie()
  const prefersHtml = (req.headers.get('accept') || '').includes('text/html')
  if (prefersHtml) {
    return NextResponse.redirect(new URL('/login', req.url), { status: 303 })
  }
  return NextResponse.json({ ok: true })
}
