import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveQuickSearchNavigation } from '../lib/quick-search'

test('routes normal quick search text to discover', () => {
  const result = resolveQuickSearchNavigation('benchy', { isAdmin: false })

  assert.equal(result.navRoute, null)
  assert.equal(result.discoverQuery, 'benchy')
  assert.equal(result.adminOnly, false)
})

test('keeps public hashtag routing available for normal users', () => {
  const result = resolveQuickSearchNavigation('#cart', { isAdmin: false })

  assert.equal(result.navRoute, '/cart')
  assert.equal(result.discoverQuery, '')
  assert.equal(result.adminOnly, false)
})

test('keeps public orders hashtag available for normal users', () => {
  const result = resolveQuickSearchNavigation('#orders', { isAdmin: false })

  assert.equal(result.navRoute, '/customer/orders')
  assert.equal(result.discoverQuery, '')
  assert.equal(result.adminOnly, false)
})

test('rejects admin-only hashtags for non-admin users', () => {
  const result = resolveQuickSearchNavigation('sam #users', { isAdmin: false })

  assert.equal(result.navRoute, '/admin/users?q=sam')
  assert.equal(result.discoverQuery, '')
  assert.equal(result.adminOnly, true)
})

test('routes admin hashtag text into admin model search', () => {
  const result = resolveQuickSearchNavigation('gear bracket #models', { isAdmin: true })

  assert.equal(result.navRoute, '/admin/models?q=gear+bracket')
  assert.equal(result.discoverQuery, '')
  assert.equal(result.adminOnly, true)
})

test('routes admin users and jobs hashtags with query text', () => {
  assert.equal(resolveQuickSearchNavigation('steph #users', { isAdmin: true }).navRoute, '/admin/users?q=steph')
  assert.equal(resolveQuickSearchNavigation('pi_123 #jobs', { isAdmin: true }).navRoute, '/admin/jobs?q=pi_123')
})

test('keeps catalog scope hashtags on discover for non-admin users', () => {
  const result = resolveQuickSearchNavigation('shirt #merch', { isAdmin: false })

  assert.equal(result.navRoute, null)
  assert.equal(result.discoverQuery, 'shirt #merch')
  assert.equal(result.adminOnly, false)
})

test('routes admin merch hashtag to the admin catalog', () => {
  const result = resolveQuickSearchNavigation('shirt #merch', { isAdmin: true })

  assert.equal(result.navRoute, '/admin/catalog?q=shirt')
  assert.equal(result.discoverQuery, '')
  assert.equal(result.adminOnly, true)
})
