import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import SuiteSetupPanel from '../components/admin/SuiteSetupPanel'

test('suite setup panel renders grouped onboarding controls', () => {
  const html = renderToStaticMarkup(<SuiteSetupPanel initialSettings={{}} />)
  assert.match(html, /MakerWorks/)
  assert.match(html, /PrintLab/)
  assert.match(html, /StockWorks/)
  assert.match(html, /YouTube/)
  assert.match(html, /Test connection/)
  assert.match(html, /Generate PrintLab submit token/)
  assert.match(html, /host\.docker\.internal:8289/)
})

test('suite setup panel renders generated tokens in a copyable full-width field', () => {
  const token = 'printlab_submit_abcdefghijklmnopqrstuvwxyz0123456789'
  const html = renderToStaticMarkup(
    <SuiteSetupPanel
      initialSettings={{}}
      initialOneTimeToken={{ label: 'PrintLab submit token', token }}
    />,
  )

  assert.match(html, /PrintLab submit token/)
  assert.match(html, new RegExp(`value="${token}"`))
  assert.match(html, /readOnly/)
  assert.match(html, /Copy token/)
  assert.match(html, /font-mono/)
  assert.doesNotMatch(html, /<code/)
})
