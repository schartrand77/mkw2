import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canChooseUploadVisibility,
  resolveUploadVisibility,
  UPLOAD_VISIBILITIES,
} from '../lib/upload-visibility'

test('only admins and staff can choose upload visibility', () => {
  assert.equal(canChooseUploadVisibility({ isAdmin: true, role: 'customer' }), true)
  assert.equal(canChooseUploadVisibility({ isAdmin: false, role: 'admin' }), true)
  assert.equal(canChooseUploadVisibility({ isAdmin: false, role: 'staff' }), true)
  assert.equal(canChooseUploadVisibility({ isAdmin: false, role: 'customer' }), false)
  assert.equal(canChooseUploadVisibility(null), false)
})

test('admin upload visibility accepts public unlisted and private', () => {
  assert.deepEqual(UPLOAD_VISIBILITIES, ['public', 'unlisted', 'private'])
  assert.equal(resolveUploadVisibility('public', true), 'public')
  assert.equal(resolveUploadVisibility('unlisted', true), 'unlisted')
  assert.equal(resolveUploadVisibility('private', true), 'private')
})

test('upload visibility falls back to public for invalid or non-admin input', () => {
  assert.equal(resolveUploadVisibility('private', false), 'public')
  assert.equal(resolveUploadVisibility('unlisted', false), 'public')
  assert.equal(resolveUploadVisibility('hidden', true), 'public')
  assert.equal(resolveUploadVisibility('', true), 'public')
  assert.equal(resolveUploadVisibility(undefined, true), 'public')
})
