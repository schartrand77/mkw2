import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPreflightAssistant } from '../lib/preflight-assistant'

test('preflight assistant emits high-priority remediation steps for risky geometry', () => {
  const result = buildPreflightAssistant({
    material: 'PLA',
    finish: 'polished',
    toleranceClass: 'fit_critical',
    printabilityScore: 42,
    failureRiskScore: 68,
    supportLikelihood: 0.74,
    orientationSuggestion: 'Lay the broad face down.',
    leadTimeHours: 30,
    etaConfidenceScore: 0.58,
    sizeXmm: 220,
    sizeYmm: 140,
    sizeZmm: 160,
  })

  assert.match(result.summary, /Preflight found setup changes worth making/i)
  assert.equal(result.suggestions.length > 0, true)
  assert.equal(result.suggestions.some((entry) => entry.priority === 'high'), true)
  assert.equal(result.suggestions.some((entry) => entry.id === 'reduce-risk'), true)
  assert.equal(result.suggestions.some((entry) => entry.id === 'support-strategy'), true)
})

test('preflight assistant stays calm for production-ready setups', () => {
  const result = buildPreflightAssistant({
    material: 'PETG',
    finish: 'standard',
    toleranceClass: 'standard',
    printabilityScore: 90,
    failureRiskScore: 18,
    supportLikelihood: 0.14,
    orientationSuggestion: 'Lay the broad face down.',
    leadTimeHours: 8,
    etaConfidenceScore: 0.91,
    sizeXmm: 80,
    sizeYmm: 50,
    sizeZmm: 30,
  })

  assert.match(result.summary, /stable|optimizations/i)
  assert.equal(result.confidence >= 0.6, true)
  assert.equal(result.suggestions.length <= 2, true)
})
