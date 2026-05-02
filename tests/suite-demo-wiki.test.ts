import assert from 'node:assert/strict'
import test from 'node:test'

import { SUITE_DEMO_SCREENSHOTS } from '../lib/suite-demo/manifest'
import { buildSuiteDemoWiki } from '../lib/suite-demo/wiki'

test('suite demo screenshot manifest filenames are unique', () => {
  const filenames = SUITE_DEMO_SCREENSHOTS.map((entry) => entry.filename)
  assert.equal(new Set(filenames).size, filenames.length)
})

test('suite demo wiki references every screenshot filename', () => {
  const markdown = buildSuiteDemoWiki()

  for (const entry of SUITE_DEMO_SCREENSHOTS) {
    assert.match(markdown, new RegExp(`assets/suite-screenshots/${entry.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  }
})

test('suite demo wiki documents synthetic data and printer action safety', () => {
  const markdown = buildSuiteDemoWiki()

  assert.match(markdown, /synthetic/i)
  assert.match(markdown, /real printer actions/i)
  assert.match(markdown, /MW-DEMO-1001/)
  assert.match(markdown, /PL-DEMO-1001/)
})
