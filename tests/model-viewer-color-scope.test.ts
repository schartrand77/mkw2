import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePartScopedColorOverrides } from '../components/ModelViewer'

test('part-specific viewer color overrides are scoped to the matching part', () => {
  const scoped = resolvePartScopedColorOverrides(
    ['#ff0000', '#00ff00'],
    { partA: '#123456', partB: '#abcdef' },
    'partB',
    1,
  )

  assert.deepEqual(scoped, ['#abcdef'])
})

test('viewer keeps full AMS overrides when there is no part color map', () => {
  const scoped = resolvePartScopedColorOverrides(['#ff0000', '#00ff00'], null, 'partB', 1)

  assert.deepEqual(scoped, ['#ff0000', '#00ff00'])
})
