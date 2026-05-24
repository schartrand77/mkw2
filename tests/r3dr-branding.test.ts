import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('global layout includes r3Dr parent-company branding', async () => {
  const layout = await readFile('app/layout.tsx', 'utf8')
  const brand = await readFile('lib/brand.ts', 'utf8')

  assert.match(brand, /PARENT_COMPANY_NAME = 'r3Dr'/)
  assert.match(brand, /PARENT_COMPANY_URL = 'https:\/\/r3dr\.com'/)
  assert.match(layout, /An r3Dr company/)
  assert.match(layout, /href=\{PARENT_COMPANY_URL\}/)
  assert.doesNotMatch(layout, /parent-company-strip/)
  assert.match(layout, /<footer className="footer-shell app-footer/)
  assert.match(layout, /className="footer-business-grid"/)
  assert.match(layout, /MakerWorks 3D Print Lab/)
})
