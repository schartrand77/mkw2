import assert from 'node:assert/strict'
import test from 'node:test'

import { buildWebhookPortalSnapshot, getWebhookDocSections } from '../lib/webhook-operations'

test('webhook portal snapshot reflects configured secrets', () => {
  const snapshot = buildWebhookPortalSnapshot({
    MAKERWORKS_INBOUND_SECRET: 'abc123',
    PRINTLAB_WEBHOOK_SECRET: 'printlab456',
  })

  assert.equal(snapshot.summary.total, 2)
  assert.equal(snapshot.summary.configured, 2)
  assert.equal(snapshot.endpoints.every((entry) => entry.secretConfigured), true)
})

test('webhook portal snapshot reports missing secret posture', () => {
  const snapshot = buildWebhookPortalSnapshot({})
  assert.equal(snapshot.summary.configured, 0)
  assert.equal(snapshot.endpoints.some((entry) => entry.notes.some((note) => /Missing secret configuration/i.test(note))), true)
})

test('webhook docs expose auth model and rotation guidance', () => {
  const docs = getWebhookDocSections()
  assert.equal(docs.some((entry) => entry.id === 'auth-model'), true)
  assert.equal(docs.some((entry) => entry.id === 'rotation'), true)
  assert.equal(docs.some((entry) => entry.bullets.some((bullet) => /HMAC|signature/i.test(bullet))), true)
})
