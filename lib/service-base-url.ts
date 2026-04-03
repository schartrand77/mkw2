export function normalizeServiceBaseUrl(raw?: string | null, defaultProtocol = 'http://') {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `${defaultProtocol}${trimmed.replace(/^\/+/, '')}`

  try {
    const url = new URL(withProtocol)
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    return withProtocol.replace(/\/+$/, '')
  }
}
