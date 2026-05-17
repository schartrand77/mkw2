import assert from 'node:assert/strict'
import test from 'node:test'

import { isPublicPath } from '../proxy'

test('payment badge assets bypass the auth proxy', () => {
  assert.equal(isPublicPath('/ApplePay.svg'), true)
  assert.equal(isPublicPath('/GooglePay.png'), true)
})

test('public image asset folders bypass the auth proxy', () => {
  assert.equal(isPublicPath('/badges/first_upload.png'), true)
  assert.equal(isPublicPath('/brand/logo.png'), true)
})
