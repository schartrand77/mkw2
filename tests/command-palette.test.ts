import test from 'node:test'
import assert from 'node:assert/strict'

import {
  filterCommandPaletteActions,
  getCommandPaletteActions,
  resolvePaletteRoute,
} from '@/lib/command-palette'

test('resolvePaletteRoute prioritizes navigation tags and preserves discover search tags', () => {
  const resolved = resolvePaletteRoute('#inventory red pla')
  assert.equal(resolved.navRoute, '/admin/inventory')
  assert.equal(resolved.discoverQuery, 'red pla')

  const discoverResolved = resolvePaletteRoute('gear kit #products')
  assert.equal(discoverResolved.navRoute, '/discover')
  assert.equal(discoverResolved.discoverQuery, 'gear kit #products')
})

test('getCommandPaletteActions includes role-aware actions', () => {
  const guestActions = getCommandPaletteActions({ authed: false, isAdmin: false, cartCount: 0 })
  assert.equal(guestActions.some((action) => action.href === '/upload'), false)
  assert.equal(guestActions.some((action) => action.href === '/admin'), false)

  const adminActions = getCommandPaletteActions({ authed: true, isAdmin: true, cartCount: 3 })
  assert.equal(adminActions.some((action) => action.href === '/upload'), true)
  assert.equal(adminActions.some((action) => action.href === '/admin'), true)
  const cartAction = adminActions.find((action) => action.href === '/cart')
  assert.match(cartAction?.description || '', /3 items/)
})

test('filterCommandPaletteActions ranks label and keyword matches ahead of weaker matches', () => {
  const actions = getCommandPaletteActions({ authed: true, isAdmin: true, cartCount: 0 })
  const filtered = filterCommandPaletteActions('inventory', actions)
  assert.equal(filtered[0]?.href, '/admin/inventory')

  const discoverFiltered = filterCommandPaletteActions('shop merch', actions)
  assert.equal(discoverFiltered[0]?.href, '/products')
})
