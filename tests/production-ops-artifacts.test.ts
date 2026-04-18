import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('production ops integration documents safe Codex access and deployment guardrails', async () => {
  const doc = await readFile('docs/production-ops.md', 'utf8')

  assert.match(doc, /SSH \/ Docker Context/)
  assert.match(doc, /Read-only inspection/)
  assert.match(doc, /Require explicit approval/)
  assert.match(doc, /GitOps deployment/)
  assert.match(doc, /Rollback/)
  assert.match(doc, /Printer controls/)
})

test('suite status script supports local and remote production checks without embedding secrets', async () => {
  const script = await readFile('scripts/suite-status.ps1', 'utf8')

  assert.match(script, /param\(/)
  assert.match(script, /\$Target/)
  assert.match(script, /\$ProductionComposePath/)
  assert.match(script, /ssh /)
  assert.match(script, /docker ps/)
  assert.match(script, /docker compose ps/)
  assert.match(script, /curl -/)
  assert.match(script, /Invoke-WebRequest/)
  assert.doesNotMatch(script, /ADMIN_PASSWORD|DATABASE_URL|SECRET_KEY|API_KEY|ACCESS_CODE/)
})
