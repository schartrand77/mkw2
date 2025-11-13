import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_EXACT = new Set([
  '/login',
  '/manifest.webmanifest',
  '/sw.js',
  '/robots.txt',
  '/sitemap.xml',
])
const PUBLIC_PREFIXES = ['/favicon', '/apple-touch-icon', '/_next']

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Allow login page, manifest, service worker, and favicons to bypass auth
  if (isPublicPath(pathname)) return NextResponse.next()

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
    '/((?!api|_next/|favicon.ico|robots.txt|sitemap.xml|files/).*)',
  ],
}
