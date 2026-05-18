import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

test('site config page does not embed the dedicated notifications card', () => {
  const pageSource = readFileSync(path.join(process.cwd(), 'app/admin/site-config/page.tsx'), 'utf8')

  assert.doesNotMatch(pageSource, /PushNotificationsCard/)
  assert.doesNotMatch(pageSource, /Push notifications/)
})
