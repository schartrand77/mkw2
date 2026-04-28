import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'

import { ensureProcessableImageBuffer } from '@/lib/image-processing'

test('does not HEIC-convert a JPEG uploaded with a heic filename', async () => {
  const jpegNamedHeic = Buffer.from([
    0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45, 0x78,
    0x69, 0x66, 0x00, 0x00, 0xff, 0xd9,
  ])

  const prepared = await ensureProcessableImageBuffer(jpegNamedHeic, { filename: 'cover.heic' })

  assert.equal(prepared.buffer, jpegNamedHeic)
})

test('keeps HEIF-family images that sharp can decode without heic-convert preprocessing', async () => {
  const heifFamilyBuffer = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  }).avif().toBuffer()

  const prepared = await ensureProcessableImageBuffer(heifFamilyBuffer, { filename: 'cover.heic' })

  assert.equal(prepared.buffer, heifFamilyBuffer)
})
