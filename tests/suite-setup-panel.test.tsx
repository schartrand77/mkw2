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
})
