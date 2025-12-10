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
    const cleaned = trimmed.replace(/\/+$/, '')
    return cleaned || null
  }
}

export function resolveBaseUrl() {
  const fromEnv = sanitize(process.env.BASE_URL)
  if (fromEnv) return fromEnv
  const headerList = headers()
  const host = headerList.get('x-forwarded-host') || headerList.get('host')
  if (!host) return 'http://localhost:3000'
  const proto = headerList.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const protocol = proto || (host.includes('localhost') ? 'http' : 'https')
  return `${protocol}://${host}`.replace(/\/+$/, '')
}
