import type { NextRequest } from 'next/server'

function extractOriginFromReferer(referer: string | null): string | null {
  if (!referer) return null
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null
  const first = value.split(',')[0]?.trim()
  return first || null
}

function extractForwardedHostAndProto(forwarded: string | null): { host: string | null; proto: string | null } {
  if (!forwarded) return { host: null, proto: null }
  const hostMatch = forwarded.match(/(?:^|;|\s)host=([^;,\s]+)/i)
  const protoMatch = forwarded.match(/(?:^|;|\s)proto=([^;,\s]+)/i)
  const host = hostMatch?.[1]?.replace(/^"|"$/g, '')?.trim() || null
  const proto = protoMatch?.[1]?.replace(/^"|"$/g, '')?.trim() || null
  return { host, proto }
}

function normalizeOrigin(input: string): string | null {
  try {
    return new URL(input).origin
  } catch {
    return null
  }
}

function expectedOrigins(req: NextRequest): Set<string> {
  const origins = new Set<string>()

  origins.add(req.nextUrl.origin)

  const forwarded = extractForwardedHostAndProto(req.headers.get('forwarded'))
  const xfHost = firstHeaderValue(req.headers.get('x-forwarded-host'))
  const xfProto = firstHeaderValue(req.headers.get('x-forwarded-proto'))
  const host = xfHost || forwarded.host || req.headers.get('host') || null
  const proto = xfProto || forwarded.proto || req.nextUrl.protocol.replace(':', '')
  if (host && proto) {
    const proxied = normalizeOrigin(`${proto}://${host}`)
    if (proxied) origins.add(proxied)
  }

  const baseOrigin = normalizeOrigin(process.env.BASE_URL || '')
  if (baseOrigin) origins.add(baseOrigin)

  return origins
}

export function isSameOriginRequest(req: NextRequest) {
  const expected = expectedOrigins(req)
  const origin = req.headers.get('origin')
  if (origin) return expected.has(origin)

  const refererOrigin = extractOriginFromReferer(req.headers.get('referer'))
  if (refererOrigin) return expected.has(refererOrigin)

  // Some clients/proxies strip Origin/Referer; allow browser same-origin/same-site fetches.
  const fetchSite = req.headers.get('sec-fetch-site')
  if (fetchSite === 'same-origin' || fetchSite === 'same-site') return true

  return false
}
