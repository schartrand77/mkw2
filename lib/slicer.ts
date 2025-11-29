const DEFAULT_BASE_URL = (process.env.BASE_URL || '').trim()

function normalizeBaseUrl(raw: string) {
  if (!raw) return ''
  return raw.replace(/\/+$/, '')
}

export function buildAbsoluteUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return null
  const trimmed = String(pathOrUrl).trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  const base = normalizeBaseUrl(DEFAULT_BASE_URL)
  if (!base) return null
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${base}${normalizedPath}`
}

export function buildBambuStudioUrl(fileUrl?: string | null) {
  if (!fileUrl) return null
  return `bambu-studio://import-model?url=${encodeURIComponent(fileUrl)}`
}

export function buildBambuStudioUrlFromPath(pathOrUrl?: string | null) {
  const abs = buildAbsoluteUrl(pathOrUrl)
  return buildBambuStudioUrl(abs)
}
