import sharp from 'sharp'
import { isHeicLikeSource } from './images'

type BufferInfo = { filename?: string | null; mimeType?: string | null }

export type PreparedImageBuffer = { buffer: Buffer; orientation?: number }
const DEFAULT_HEIC_MAX_SOURCE_BYTES = 40 * 1024 * 1024
const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
])

function readPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback
}

function toErrorMessage(err: unknown) {
  if (err instanceof Error && typeof err.message === 'string') return err.message
  return String(err || '')
}

function looksLikeHeifContainer(buffer: Buffer) {
  if (buffer.length < 12) return false
  if (buffer.subarray(4, 8).toString('ascii') !== 'ftyp') return false
  const end = Math.min(buffer.length, 64)
  for (let offset = 8; offset + 4 <= end; offset += 4) {
    if (HEIF_BRANDS.has(buffer.subarray(offset, offset + 4).toString('ascii'))) {
      return true
    }
  }
  return false
}

async function readOrientation(buffer: Buffer): Promise<number | undefined> {
  try {
    const mod = await import('exifr')
    const exifr: any = (mod as any).default || mod
    const data = await exifr.parse(buffer, { translateValues: false })
    const orientation = data?.Orientation ?? data?.orientation ?? data?.OrientationValue
    return typeof orientation === 'number' ? orientation : undefined
  } catch (err) {
    console.debug('Failed to parse EXIF orientation:', err)
    return undefined
  }
}

export async function ensureProcessableImageBuffer(buffer: Buffer, info?: BufferInfo): Promise<PreparedImageBuffer> {
  if (!buffer || buffer.length === 0) return { buffer }
  const isHeic = Boolean(info && isHeicLikeSource(info.filename, info.mimeType) && looksLikeHeifContainer(buffer))
  const orientation = isHeic ? await readOrientation(buffer) : undefined
  if (!isHeic) return { buffer, orientation }
  const maxSourceBytes = readPositiveIntEnv('HEIC_MAX_SOURCE_BYTES', DEFAULT_HEIC_MAX_SOURCE_BYTES)
  if (buffer.length > maxSourceBytes) {
    throw new Error(`HEIC source file too large (${buffer.length} bytes). Limit is ${maxSourceBytes} bytes.`)
  }

  try {
    const mod = await import('heic-convert')
    const heicConvert = (mod as any).default || mod
    const converted = await heicConvert({ buffer, format: 'PNG', quality: 1 })
    const out = Buffer.isBuffer(converted) ? converted : Buffer.from(converted)
    return { buffer: out, orientation }
  } catch (err) {
    const msg = toErrorMessage(err).toLowerCase()
    if (msg.includes('security limit exceeded') || msg.includes('memory allocation error')) {
      throw new Error('HEIC image is too large to decode safely. Please export it at a lower resolution and upload again.')
    }
    throw new Error(`HEIC conversion failed: ${toErrorMessage(err)}`)
  }
}

export function applyKnownOrientation(image: sharp.Sharp, orientation?: number) {
  switch (orientation) {
    case 2:
      return image.flop()
    case 3:
      return image.rotate(180)
    case 4:
      return image.flip()
    case 5:
      return image.rotate(90).flop()
    case 6:
      return image.rotate(90)
    case 7:
      return image.rotate(270).flop()
    case 8:
      return image.rotate(270)
    default:
      return image.rotate()
  }
}
