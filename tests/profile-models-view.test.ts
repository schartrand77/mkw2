import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PROFILE_MODELS_VIEW_COOKIE,
  buildProfileModelsHref,
  resolveProfileModelsViewMode,
} from '../lib/profile-models-view'

test('profile model view falls back to compact cookie', () => {
  assert.equal(resolveProfileModelsViewMode(null, 'compact'), 'compact')
})

test('profile model view URL grid overrides compact cookie', () => {
  assert.equal(resolveProfileModelsViewMode('grid', 'compact'), 'grid')
})

test('profile model pagination href preserves compact view', () => {
  assert.equal(PROFILE_MODELS_VIEW_COOKIE, 'mwv2_profile_models_view')
  assert.equal(buildProfileModelsHref('maker', 2, 'compact'), '/u/maker?page=2&view=compact')
})

test('profile model pagination href preserves explicit grid view', () => {
  assert.equal(buildProfileModelsHref('maker', 3, 'grid'), '/u/maker?page=3&view=grid')
})
