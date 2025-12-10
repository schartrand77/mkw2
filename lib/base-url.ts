import { headers } from 'next/headers'

function sanitize(raw?: string | null) {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    url.hash = ''
    url.search = ''
    return url.origin.replace(/\/+$/, '')
  } catch {
    return trimmed.replace(/\/+$/, '') || null
  }
}

function resolveFromVercelEnv() {
  const raw = process.env.VERCEL_URL
  if (!raw) return null
  const prefixed = raw.startsWith('http') ? raw : `https://${raw}`
  return sanitize(prefixed)
}

async function resolveFromHeaders() {
  try {
    const hdrs = await headers()
    const proto = hdrs.get('x-forwarded-proto') || hdrs.get('x-forwarded-protocol') || 'https'
    const host = hdrs.get('x-forwarded-host') || hdrs.get('host')
    if (host) {
      return sanitize(`${proto}://${host}`)
    }
  } catch {
    // headers() is unavailable outside the request lifecycle; ignore.
  }
  return null
}

export async function resolveBaseUrl() {
  return sanitize(process.env.BASE_URL) || resolveFromVercelEnv() || await resolveFromHeaders() || ''
}
