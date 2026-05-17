import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { validateJwtSecret } from '@/lib/security-config'
const PUBLIC_EXACT = new Set([
  '/',
  '/discover',
  '/login',
  '/register',
  '/signed-out',
  '/gear',
  '/manifest.webmanifest',
  '/sw.js',
  '/robots.txt',
  '/sitemap.xml',
  '/ApplePay.svg',
  '/GooglePay.png',
  '/badges.png',
])
const PUBLIC_PREFIXES = ['/favicon', '/apple-touch-icon', '/_next', '/icons', '/badges', '/brand', '/images', '/screenshots']

export function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

async function isValidJwt(token: string) {
  const secret = process.env.JWT_SECRET
  const validation = validateJwtSecret(secret)
  if (!validation.ok) return false
  try {
    await jwtVerify(token, new TextEncoder().encode(secret as string), { algorithms: ['HS256'] })
    return true
  } catch {
    return false
  }
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  // Allow login page, manifest, service worker, and favicons to bypass auth
  if (isPublicPath(pathname) || isPublicModelPath(pathname)) return NextResponse.next()

  const loginUrl = new URL('/login', req.url)
  const nextPath = `${pathname}${search || ''}`
  if (nextPath.startsWith('/')) {
    loginUrl.searchParams.set('next', nextPath)
  }

  const token = req.cookies.get('mwv2_token')?.value
  if (!token) {
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('mwv2_token')
    return response
  }
  if (!(await isValidJwt(token))) {
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('mwv2_token')
    return response
  }
  return NextResponse.next()
}

function isPublicModelPath(pathname: string) {
  if (!pathname.startsWith('/models')) return false
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] !== 'models') return false
  // Allow /models and /models/:id but require auth for nested routes like /models/:id/edit
  return segments.length <= 2
}

// Run on all pages except API routes, static assets, and file-serving route
export const config = {
  matcher: [
    // Match all paths except those starting with the following segments
    '/((?!api|_next/|favicon.ico|robots.txt|sitemap.xml|files/).*)',
  ],
}
