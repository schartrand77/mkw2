const RAW_IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'pjpeg',
  'pjp',
  'webp',
  'gif',
  'bmp',
  'dib',
  'tif',
  'tiff',
  'svg',
  'avif',
  'heic',
  'heif',
  'ico',
] as const

export const SUPPORTED_IMAGE_EXTENSIONS = [...RAW_IMAGE_EXTENSIONS]

const EXTENSION_LIST = SUPPORTED_IMAGE_EXTENSIONS.map(ext => `.${ext}`)
export const IMAGE_ACCEPT_ATTRIBUTE = `image/*,${Array.from(new Set(EXTENSION_LIST)).join(',')}`

export function isSupportedImageFile(name: string | null | undefined, mimeType?: string | null | undefined): boolean {
  if (mimeType && mimeType.toLowerCase().startsWith('image/')) return true
  if (!name) return false
  const lower = name.toLowerCase().split('?')[0]
  return SUPPORTED_IMAGE_EXTENSIONS.some(ext => lower.endsWith(`.${ext}`))
}

function isHeicLike(name?: string | null, mimeType?: string | null) {
  const lowerMime = mimeType?.toLowerCase() || ''
  if (lowerMime.includes('heic') || lowerMime.includes('heif')) return true
  const lowerName = name?.toLowerCase() || ''
  return lowerName.endsWith('.heic') || lowerName.endsWith('.heif')
}

type BufferInfo = { filename?: string | null; mimeType?: string | null }

export async function ensureProcessableImageBuffer(buffer: Buffer, info?: BufferInfo): Promise<Buffer> {
  if (!buffer || buffer.length === 0) return buffer
  if (!info) return buffer
  if (!isHeicLike(info.filename, info.mimeType)) return buffer
  try {
    const mod = await import('heic-convert')
    const heicConvert = (mod as any).default || mod
    const converted = await heicConvert({ buffer, format: 'PNG', quality: 1 })
    return Buffer.isBuffer(converted) ? converted : Buffer.from(converted)
  } catch (err) {
    console.error('HEIC conversion failed, falling back to raw buffer:', err)
    return buffer
  }
}
