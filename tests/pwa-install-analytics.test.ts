import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPwaInstallAnalyticsPayload } from '../lib/pwa-install-analytics'

test('PWA install analytics payload records accepted outcome', () => {
  assert.deepStrictEqual(
    buildPwaInstallAnalyticsPayload('accepted', { platform: 'web', source: 'prompt' }),
    {
      event: 'accepted',
      platform: 'web',
      source: 'prompt',
    },
  )
})

test('PWA install analytics payload records iOS instruction views', () => {
  assert.deepStrictEqual(
    buildPwaInstallAnalyticsPayload('ios_instruction_shown', { platform: 'ios', source: 'ios-instructions' }),
    {
      event: 'ios_instruction_shown',
      platform: 'ios',
      source: 'ios-instructions',
    },
  )
})
