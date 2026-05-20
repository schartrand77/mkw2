import assert from 'node:assert/strict'
import test from 'node:test'

import { estimatePricingDetails } from '../lib/pricing'

const baseConfig = {
  minimumPriceUsd: 0,
  printSpeedCm3PerHour: 100,
  plaPricePerKgUsd: 20,
  energyUsdPerHour: 0,
  machineUsdPerHour: 0,
  laborUsdPerHour: 0,
  extraHourlyUsdAfterFirst: 0,
}

test('target margin raises automatic price to preserve gross margin', () => {
  const base = estimatePricingDetails({
    cm3: 10,
    material: 'PLA',
    infillPct: 100,
    cfg: baseConfig,
  })

  const withMargin = estimatePricingDetails({
    cm3: 10,
    material: 'PLA',
    infillPct: 100,
    cfg: { ...baseConfig, targetMarginPercent: 40 } as any,
  }) as any

  assert.ok(withMargin.price > base.price)
  assert.equal(withMargin.targetMarginPercent, 40)
  assert.equal(withMargin.marginMultiplier, 1.667)
  assert.equal(withMargin.price, 0.41)
})
