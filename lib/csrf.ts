import type { NextRequest } from 'next/server'

function extractOriginFromReferer(referer: string | null): string | null {
  if (!referer) return null
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

export function isSameOriginRequest(req: NextRequest) {
  const expected = req.nextUrl.origin
  const origin = req.headers.get('origin')
  if (origin) return origin === expected

  const refererOrigin = extractOriginFromReferer(req.headers.get('referer'))
  if (refererOrigin) return refererOrigin === expected

  return false
}
