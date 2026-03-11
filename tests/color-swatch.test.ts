import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeHexColor, resolveColorPaint } from '@/lib/color-swatch'

test('normalizeHexColor normalizes shorthand and alpha-leading hex values', () => {
  assert.equal(normalizeHexColor('#abc'), '#aabbcc')
  assert.equal(normalizeHexColor('#ff336699'), '#336699')
})

test('resolveColorPaint returns a gradient for named multicolor stockworks entries', () => {
  const paint = resolveColorPaint({
    name: 'Blue Green Sunset',
    category: 'Multigradient',
  })
  assert.match(paint, /^linear-gradient\(135deg,/)
  assert.match(paint, /#3b82f6/)
  assert.match(paint, /#22c55e/)
})

test('resolveColorPaint synthesizes a gradient when only the category indicates gradient', () => {
  const paint = resolveColorPaint({
    name: 'Nebula',
    hex: '#8b5cf6',
    category: 'Gradient',
  })
  assert.match(paint, /^linear-gradient\(135deg,/)
})
