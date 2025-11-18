import sharp from 'sharp'
import { isHeicLikeSource } from './images'

type BufferInfo = { filename?: string | null; mimeType?: string | null }

export type PreparedImageBuffer = { buffer: Buffer; orientation?: number }

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
  const orientation = await readOrientation(buffer)
  if (!info || !isHeicLikeSource(info.filename, info.mimeType)) {
    return { buffer, orientation }
  }

  try {
    const mod = await import('heic-convert')
    const heicConvert = (mod as any).default || mod
    const converted = await heicConvert({ buffer, format: 'PNG', quality: 1 })
    const out = Buffer.isBuffer(converted) ? converted : Buffer.from(converted)
    return { buffer: out, orientation }
  } catch (err) {
    console.error('HEIC conversion failed, using raw buffer:', err)
    return { buffer, orientation }
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
