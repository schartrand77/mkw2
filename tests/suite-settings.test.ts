import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decryptSecretValue,
  encryptSecretValue,
  maskSecret,
  mergeRuntimeSetting,
  redactRuntimeSettings,
  resolveRuntimeSettingsFromRows,
  validateSuiteSettingsPayload,
} from '../lib/admin/suite-settings'

test('encrypts and decrypts suite secrets with a stable key', () => {
  const encrypted = encryptSecretValue('stripe-secret', '0123456789abcdef0123456789abcdef')
  assert.notEqual(encrypted, 'stripe-secret')
  assert.equal(decryptSecretValue(encrypted, '0123456789abcdef0123456789abcdef'), 'stripe-secret')
})

test('redacts secret settings but exposes configured state', () => {
  assert.equal(maskSecret('sk_live_1234567890'), 'sk_liv********7890')
  assert.equal(maskSecret('tiny'), 'configured')
  assert.deepEqual(redactRuntimeSettings({
    stripeSecretKey: { value: 'sk_live_1234567890', secret: true, source: 'database' },
    printlabBaseUrl: { value: 'http://printlab:8080', secret: false, source: 'database' },
  }), {
    stripeSecretKey: { configured: true, masked: 'sk_liv********7890', source: 'database' },
    printlabBaseUrl: { value: 'http://printlab:8080', configured: true, source: 'database' },
  })
})

test('env value wins over persisted settings while migration is in progress', () => {
  const merged = mergeRuntimeSetting({
    envValue: 'https://env.example',
    storedValue: 'https://stored.example',
    secret: false,
  })
  assert.deepEqual(merged, { value: 'https://env.example', source: 'env', secret: false })
})

test('resolves effective runtime settings from persisted rows', () => {
  const encryptionKey = '0123456789abcdef0123456789abcdef'
  const settings = resolveRuntimeSettingsFromRows({
    rows: [
      { key: 'printlabBaseUrl', value: 'http://printlab:8080', secret: false },
      { key: 'printlabApiKey', value: encryptSecretValue('printlab-secret', encryptionKey), secret: true },
      { key: 'stockworksBaseUrl', value: 'http://stockworks:8000', secret: false },
    ],
    env: {
      STOCKWORKS_BASE_URL: 'http://stockworks-env:8000',
    },
    encryptionKey,
  })

  assert.equal(settings.printlabBaseUrl.value, 'http://printlab:8080')
  assert.equal(settings.printlabBaseUrl.source, 'database')
  assert.equal(settings.printlabApiKey.value, 'printlab-secret')
  assert.equal(settings.printlabApiKey.source, 'database')
  assert.equal(settings.stockworksBaseUrl.value, 'http://stockworks-env:8000')
  assert.equal(settings.stockworksBaseUrl.source, 'env')
})

test('validates suite settings payload by category and known key', () => {
  const parsed = validateSuiteSettingsPayload({
    printlabBaseUrl: 'http://printlab:8080',
    stockworksBaseUrl: 'http://stockworks:8000',
    stripeSecretKey: 'sk_test_123',
  })
  assert.equal(parsed.printlabBaseUrl?.value, 'http://printlab:8080')
  assert.equal(parsed.stripeSecretKey?.secret, true)
})

test('rejects unknown suite setting keys', () => {
  assert.throws(
    () => validateSuiteSettingsPayload({ randomPassword: 'secret' }),
    /Unknown suite setting key/,
  )
})
