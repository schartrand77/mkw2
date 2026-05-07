import assert from 'node:assert/strict'
import test from 'node:test'

import {
  checkoutVisibleModelWhere,
  discoverVisibleModelWhere,
  isDirectOrderableVisibility,
} from '../lib/model-visibility'

test('unlisted models are direct-orderable but not discoverable', () => {
  assert.equal(isDirectOrderableVisibility('public'), true)
  assert.equal(isDirectOrderableVisibility('unlisted'), true)
  assert.equal(isDirectOrderableVisibility('private'), false)
  assert.deepEqual(discoverVisibleModelWhere(), { visibility: 'public' })
})

test('checkout visibility allows direct-link unlisted models for customers', () => {
  assert.deepEqual(checkoutVisibleModelWhere(['model_1', 'model_2'], null, false), {
    id: { in: ['model_1', 'model_2'] },
    visibility: { in: ['public', 'unlisted'] },
  })

  assert.deepEqual(checkoutVisibleModelWhere(['model_1'], 'user_1', false), {
    id: { in: ['model_1'] },
    OR: [
      { visibility: { in: ['public', 'unlisted'] } },
      { userId: 'user_1' },
    ],
  })

  assert.deepEqual(checkoutVisibleModelWhere(['model_1'], 'admin_1', true), {
    id: { in: ['model_1'] },
  })
})
