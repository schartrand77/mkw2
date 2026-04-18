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
  assert.match(script, /\$IncludeDatabase/)
  assert.match(script, /psql -U/)
  assert.match(script, /Invoke-WebRequest/)
  assert.doesNotMatch(script, /ADMIN_PASSWORD|DATABASE_URL|SECRET_KEY|API_KEY|ACCESS_CODE/)
})

test('package scripts include production suite status shortcut', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { scripts: Record<string, string> }

  assert.match(pkg.scripts['suite:status:prod'], /makerworks-prod/)
  assert.match(pkg.scripts['suite:status:prod'], /3777/)
  assert.match(pkg.scripts['suite:status:prod'], /8256/)
  assert.match(pkg.scripts['suite:status:prod'], /8983/)
  assert.match(pkg.scripts['suite:status:prod'], /3202/)
  assert.match(pkg.scripts['suite:status:prod'], /IncludeDatabase/)
  assert.doesNotMatch(pkg.scripts['suite:status:prod'], /ADMIN_PASSWORD|DATABASE_URL|SECRET_KEY|API_KEY|ACCESS_CODE/)
})

test('Unraid web template exposes the full Stripe checkout configuration', async () => {
  const template = await readFile('unraid/templates/makerworks-v2.xml', 'utf8')

  assert.match(template, /Target="STRIPE_SECRET_KEY"/)
  assert.match(template, /Target="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"/)
  assert.match(template, /Target="STRIPE_WEBHOOK_SECRET"[^>]*Mask="true"/)
  assert.match(template, /Target="STRIPE_SHIPPING_RATE_ID"/)
  assert.match(template, /Target="STRIPE_TAX_ENABLED"/)
})

test('Unraid web template exposes primary PrintLab integration configuration', async () => {
  const template = await readFile('unraid/templates/makerworks-v2.xml', 'utf8')

  assert.match(template, /Target="PRINTLAB_BASE_URL"[^>]*>http:\/\/PrintLab:8080<\/Config>/)
  assert.match(template, /Target="PRINTLAB_AUTH_HEADER"[^>]*Mask="true"/)
  assert.match(template, /Target="PRINTLAB_SESSION_COOKIE"[^>]*Mask="true"/)
  assert.match(template, /Target="PRINTLAB_API_KEY"[^>]*Mask="true"/)
  assert.match(template, /Target="PRINTLAB_WEBHOOK_SECRET"[^>]*Mask="true"/)
})
