import assert from 'node:assert/strict'
import test from 'node:test'

import { buildEnvChecks } from '../app/api/admin/env-check/route'

test('admin env checks omit missing optional integrations', () => {
  const checks = buildEnvChecks({
    DATABASE_URL: 'postgresql://makerworks.local/test',
    JWT_SECRET: 'a-valid-test-jwt-secret-with-32-chars',
  })

  assert.deepEqual(checks.map((check) => check.key), ['DATABASE_URL', 'JWT_SECRET'])
  assert.equal(checks.every((check) => check.required), true)
})

test('admin env checks include configured optional integrations', () => {
  const checks = buildEnvChecks({
    DATABASE_URL: 'postgresql://makerworks.local/test',
    JWT_SECRET: 'a-valid-test-jwt-secret-with-32-chars',
    STRIPE_SECRET_KEY: 'sk_test_example',
  })

  assert.ok(checks.some((check) => check.key === 'STRIPE_SECRET_KEY'))
})
