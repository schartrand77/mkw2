import test from 'node:test'
import assert from 'node:assert/strict'

import {
  filterLinkedVariantTemplates,
  isSecondaryOwnedVariantMaterial,
} from '../lib/product-template-variants'

test('secondary variant materials are recognized as owned by a primary template', () => {
  const templates = [
    {
      id: 'owner',
      stockworksMaterialId: 101,
      stockworksVariantMap: [
        { materialId: 101, color: 'Standard' },
        { materialId: 202, color: 'Mandarin Orange' },
        { materialId: 303, color: 'Lilac Purple' },
      ],
    },
  ]

  assert.equal(isSecondaryOwnedVariantMaterial(101, templates), false)
  assert.equal(isSecondaryOwnedVariantMaterial(202, templates), true)
  assert.equal(isSecondaryOwnedVariantMaterial(303, templates), true)
  assert.equal(isSecondaryOwnedVariantMaterial(404, templates), false)
})

test('linked variant templates are hidden when a primary template owns their material ids', () => {
  const templates = [
    {
      id: 'owner',
      title: 'ID Badge Holder',
      stockworksMaterialId: 101,
      stockworksVariantMap: [
        { materialId: 101, color: 'Standard' },
        { materialId: 202, color: 'Mandarin Orange' },
      ],
    },
    {
      id: 'duplicate',
      title: 'ID Badge Holder - Mandarin Orange',
      stockworksMaterialId: 202,
      stockworksVariantMap: null,
    },
  ]

  assert.deepEqual(
    filterLinkedVariantTemplates(templates).map((entry) => entry.id),
    ['owner'],
  )
})

test('linked variant templates are hidden by managed variant title when material links were cleared', () => {
  const templates = [
    {
      id: 'owner',
      title: 'ID Badge Holder',
      stockworksMaterialId: null,
      stockworksVariantMap: [
        { materialId: 101, color: 'Standard' },
        { materialId: 202, color: 'Mandarin Orange' },
      ],
    },
    {
      id: 'duplicate',
      title: 'ID Badge Holder - Mandarin Orange',
      stockworksMaterialId: null,
      stockworksVariantMap: null,
    },
  ]

  assert.deepEqual(
    filterLinkedVariantTemplates(templates).map((entry) => entry.id),
    ['owner'],
  )
})
