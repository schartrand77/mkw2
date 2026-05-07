import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildContributionSummary,
  normalizeContributionType,
  normalizeOrganizationCategory,
  normalizeReceiptStatus,
} from '../lib/community-contributions'

test('normalizes organization category to known business classifications', () => {
  assert.equal(normalizeOrganizationCategory('CHARITY'), 'charity')
  assert.equal(normalizeOrganizationCategory('community'), 'community')
  assert.equal(normalizeOrganizationCategory('unknown'), 'customer')
  assert.equal(normalizeOrganizationCategory(null), 'customer')
})

test('normalizes contribution type and receipt status to reporting-safe values', () => {
  assert.equal(normalizeContributionType('DONATED'), 'donated')
  assert.equal(normalizeContributionType('cost-only'), 'cost_only')
  assert.equal(normalizeContributionType('sponsored'), 'sponsored')
  assert.equal(normalizeContributionType('paid'), 'paid')
  assert.equal(normalizeContributionType('bogus'), 'paid')

  assert.equal(normalizeReceiptStatus('requested'), 'requested')
  assert.equal(normalizeReceiptStatus('RECEIVED'), 'received')
  assert.equal(normalizeReceiptStatus('not-eligible'), 'not_eligible')
  assert.equal(normalizeReceiptStatus(undefined), 'none')
})

test('builds charity contribution totals without counting paid orders as donations', () => {
  const summary = buildContributionSummary([
    {
      organizationCategory: 'charity',
      contributionType: 'donated',
      totalCents: 0,
      subtotalCents: 4500,
      donatedAmountCents: null,
      materialCostCents: 1200,
      machineTimeMinutes: 180,
      receiptStatus: 'requested',
    },
    {
      organizationCategory: 'community',
      contributionType: 'discounted',
      totalCents: 2500,
      subtotalCents: 5000,
      donatedAmountCents: 3000,
      materialCostCents: 900,
      machineTimeMinutes: 90,
      receiptStatus: 'none',
    },
    {
      organizationCategory: 'customer',
      contributionType: 'paid',
      totalCents: 7000,
      subtotalCents: 7000,
      donatedAmountCents: 9999,
      materialCostCents: 3000,
      machineTimeMinutes: 75,
      receiptStatus: 'received',
    },
  ])

  assert.deepEqual(summary, {
    orderCount: 3,
    communityOrderCount: 2,
    donatedOrderCount: 1,
    discountedOrderCount: 1,
    donatedAmountCents: 7500,
    materialCostCents: 2100,
    machineTimeMinutes: 270,
    receiptCounts: {
      none: 1,
      requested: 1,
      received: 1,
      not_eligible: 0,
    },
  })
})
