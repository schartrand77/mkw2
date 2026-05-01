import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { coerceThemeMode, resolveInitialThemeMode } from '../lib/theme-mode'

test('Canada Day particles are styled as Canadian flags instead of maple leaves', async () => {
  const css = await readFile('app/globals.css', 'utf8')
  const match = css.match(/\.holiday-canada-confetti\s*\{(?<rules>[\s\S]*?)\n\}/)

  assert.ok(match?.groups?.rules, 'Canada Day particle rules should exist')
  assert.match(match.groups.rules, /linear-gradient\(90deg,\s*rgba\(220,\s*38,\s*38/)
  assert.doesNotMatch(match.groups.rules, /clip-path:\s*polygon\(/)
})

test('theme mode parser accepts only supported stored values', () => {
  assert.equal(coerceThemeMode('light'), 'light')
  assert.equal(coerceThemeMode('dark'), 'dark')
  assert.equal(coerceThemeMode('oled'), 'oled')
  assert.equal(coerceThemeMode('canadaday'), null)
  assert.equal(coerceThemeMode(null), null)
})

test('initial theme mode resolves from storage before falling back to dark', () => {
  const storage = { getItem: () => 'light' }
  assert.equal(resolveInitialThemeMode(storage), 'light')
  assert.equal(resolveInitialThemeMode({ getItem: () => 'bad' }), 'dark')
  assert.equal(resolveInitialThemeMode({ getItem: () => { throw new Error('blocked') } }), 'dark')
})
