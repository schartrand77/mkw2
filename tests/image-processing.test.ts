import assert from 'node:assert/strict'
import test from 'node:test'

import { ensureProcessableImageBuffer } from '@/lib/image-processing'

test('does not HEIC-convert a JPEG uploaded with a heic filename', async () => {
  const jpegNamedHeic = Buffer.from([
    0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45, 0x78,
    0x69, 0x66, 0x00, 0x00, 0xff, 0xd9,
  ])

  const prepared = await ensureProcessableImageBuffer(jpegNamedHeic, { filename: 'cover.heic' })

  assert.equal(prepared.buffer, jpegNamedHeic)
})
