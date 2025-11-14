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
export function isHeicLikeSource(name?: string | null, mimeType?: string | null) {
  const lowerMime = mimeType?.toLowerCase() || ''
  if (lowerMime.includes('heic') || lowerMime.includes('heif')) return true
  const lowerName = name?.toLowerCase() || ''
  return lowerName.endsWith('.heic') || lowerName.endsWith('.heif')
}
