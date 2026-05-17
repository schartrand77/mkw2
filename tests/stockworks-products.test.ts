import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveProductTemplateStockworksUnlinks } from '../lib/stockworks-products'

test('StockWorks back-sync keeps primary product links for managed color variants', () => {
  const unlinks = resolveProductTemplateStockworksUnlinks({
    liveMaterialIds: new Set<number>(),
    linkedTemplates: [
      {
        id: 'owner',
        stockworksMaterialId: 101,
        stockworksVariantMap: [
          { materialId: 101, color: 'Standard' },
          { materialId: 202, color: 'Mandarin Orange' },
        ],
      },
      {
        id: 'stale',
        stockworksMaterialId: 303,
        stockworksVariantMap: null,
      },
    ],
  })

  assert.deepEqual(unlinks, ['stale'])
})
