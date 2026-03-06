function normalizeOrigin(url?: string | null) {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

function stripPort(host: string) {
  const trimmed = host.trim().toLowerCase()
  if (!trimmed) return ''
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']')
    return end >= 0 ? trimmed.slice(1, end) : trimmed
  }
  const parts = trimmed.split(':')
  return parts[0] || trimmed
}

function isPrivateIpv4(host: string) {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) return false
  const octets = match.slice(1).map(Number)
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  if (octets[0] === 10) return true
  if (octets[0] === 127) return true
  if (octets[0] === 192 && octets[1] === 168) return true
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true
  if (octets[0] === 169 && octets[1] === 254) return true
  return false
}

function isLocalHostname(host: string) {
  return (
    host === 'localhost'
    || host.endsWith('.local')
    || host.endsWith('.lan')
    || host === '::1'
    || host.startsWith('fe80:')
    || host.startsWith('fc')
    || host.startsWith('fd')
    || isPrivateIpv4(host)
  )
}

function parseLanSiteHosts(raw?: string | null) {
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return stripPort(new URL(entry).host)
      } catch {
        return stripPort(entry)
      }
    })
}

export function isLanRequestHost(hostHeader?: string | null, lanSiteHostsRaw?: string | null) {
  if (!hostHeader) return false
  const host = stripPort(hostHeader)
  if (!host) return false
  if (isLocalHostname(host)) return true
  const allowedHosts = parseLanSiteHosts(lanSiteHostsRaw)
  return allowedHosts.includes(host)
}

export function resolveUploadUrlForRequestHost(options: {
  requestHost?: string | null
  directUploadUrl?: string | null
  lanDirectUploadUrl?: string | null
  lanSiteHosts?: string | null
}) {
  const { requestHost, directUploadUrl, lanDirectUploadUrl, lanSiteHosts } = options
  if (lanDirectUploadUrl && isLanRequestHost(requestHost, lanSiteHosts)) {
    return lanDirectUploadUrl
  }
  return directUploadUrl || null
}

export function getAllowedUploadOrigins(urls: Array<string | null | undefined>) {
  return Array.from(new Set(urls.map((value) => normalizeOrigin(value)).filter((value): value is string => Boolean(value))))
}

export function readUploadByteEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const trimmed = raw.trim().toLowerCase()
  if (trimmed === '0' || trimmed === 'unlimited' || trimmed === 'none' || trimmed === 'off') {
    return null
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
