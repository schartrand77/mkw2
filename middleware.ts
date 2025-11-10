import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Allow login page and Next.js internals via matcher below; double-check login here
  if (pathname === '/login') return NextResponse.next()

  const token = req.cookies.get('mwv2_token')?.value
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

// Run on all pages except API routes, static assets, and file-serving route
export const config = {
  matcher: [
    // Match all paths except those starting with the following segments
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|files/).*)',
  ],
}

