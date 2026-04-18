import assert from 'node:assert/strict'
import test from 'node:test'

import { isColorAvailableForMaterial } from '../lib/filament-palette-validation'

const palette = {
  enabled: true,
  materials: {
    PETG: {
      inStock: [{ name: 'Black', hex: '#000000' }],
      orderable: [{ name: 'White', hex: '#ffffff' }],
    },
    PLA: {
      inStock: [{ name: 'Charcoal', hex: '#000000' }],
      orderable: [{ name: 'Ivory White', hex: '#ffffff' }],
    },
  },
}

test('filament palette rejects a PLA-only color for PETG even when hex matches', () => {
  assert.equal(isColorAvailableForMaterial('Charcoal #000000', palette, 'PETG'), false)
})

test('filament palette accepts colors scoped to the selected material', () => {
  assert.equal(isColorAvailableForMaterial('Black #000000', palette, 'PETG'), true)
  assert.equal(isColorAvailableForMaterial('Charcoal #000000', palette, 'PLA'), true)
})
