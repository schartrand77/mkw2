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

export function resolveBaseUrl() {
  return sanitize(process.env.BASE_URL) || ''
}
