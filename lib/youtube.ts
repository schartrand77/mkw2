const DIRECT_ID = /^[A-Za-z0-9_-]{11}$/

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
])

function normalizeInput(input: string): string {
  return (input || '').trim()
}

export function extractYouTubeId(rawInput: string | null | undefined): string | null {
  const input = normalizeInput(rawInput || '')
  if (!input) return null
  if (DIRECT_ID.test(input)) return input

  let parsed: URL | null = null
  const candidates = input.includes('://') ? [input] : [`https://${input}`, input]
  for (const candidate of candidates) {
    try {
      parsed = new URL(candidate)
      break
    } catch {
      continue
    }
  }
  if (!parsed) return null
  const host = parsed.hostname.toLowerCase()
  if (!YOUTUBE_HOSTS.has(host)) return null

  if (host === 'youtu.be') {
    const segments = parsed.pathname.split('/').filter(Boolean)
    const id = segments[0]
    return id && DIRECT_ID.test(id) ? id : null
  }

  const vParam = parsed.searchParams.get('v')
  if (vParam && DIRECT_ID.test(vParam)) return vParam

  if (parsed.pathname.startsWith('/embed/')) {
    const id = parsed.pathname.replace('/embed/', '').split('/')[0]
    if (DIRECT_ID.test(id)) return id
  }

  return null
}

export function buildYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0`
}
