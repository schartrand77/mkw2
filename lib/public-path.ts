// Pure helper for converting stored file paths to public `/files/...` URLs.
// Safe to import in client components.
export function toPublicHref(p: string | null | undefined): string | null {
  if (!p) return null
  let s = String(p).replace(/\\/g, '/')
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.startsWith('/files/')) return s
  const storageIdx = s.indexOf('/storage/')
  if (storageIdx !== -1) s = s.slice(storageIdx + '/storage/'.length)
  else if (s.startsWith('/app/storage/')) s = s.slice('/app/storage/'.length)
  else if (s.startsWith('storage/')) s = s.slice('storage/'.length)
  if (!s.startsWith('/')) s = '/' + s
  return '/files' + s
}

export function buildImageSrc(p: string | null | undefined, version?: string | number | Date | null): string | null {
  const base = toPublicHref(p)
  if (!base) return null
  if (version == null) return base
  let stamp: number | null = null
  if (typeof version === 'number') {
    stamp = Number.isFinite(version) ? Math.round(version) : null
  } else if (version instanceof Date) {
    stamp = Number.isFinite(version.getTime()) ? version.getTime() : null
  } else if (typeof version === 'string') {
    const parsed = Date.parse(version)
    stamp = Number.isFinite(parsed) ? parsed : null
  }
  if (!stamp || stamp <= 0) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}v=${stamp}`
}
