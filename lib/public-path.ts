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
