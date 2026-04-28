import assert from 'node:assert/strict'
import test from 'node:test'
import { buildModelCardMedia, validateAdminModelImageAlt } from '../lib/model-media-contract'

test('admin model images require alt text', () => {
  assert.equal(validateAdminModelImageAlt(' angled product view ').ok, true)
  assert.deepStrictEqual(validateAdminModelImageAlt('  '), {
    ok: false,
    error: 'Alt text is required for model card images.',
  })
})

test('model card media falls back when cover is unavailable', () => {
  assert.deepStrictEqual(
    buildModelCardMedia({ title: 'Calibration Cube', coverImagePath: null, coverImageStatus: 'failed' }),
    {
      src: '/images/model-card-fallback.svg',
      alt: 'Calibration Cube',
      fallbackSrc: '/images/model-card-fallback.svg',
      state: 'fallback',
    },
  )
})
