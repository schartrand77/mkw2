import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import BackupControls from '../components/admin/BackupControls'

test('backup controls do not render obsolete OrderWorks queue links', () => {
  const html = renderToStaticMarkup(<BackupControls />)

  assert.doesNotMatch(html, /OrderWorks/)
  assert.doesNotMatch(html, /href="\/admin\/jobs"/)
})
