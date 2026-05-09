import assert from 'node:assert/strict'
import test from 'node:test'

import {
  describeProductionContribution,
  extractPrintLabSubmissionSummary,
  formatProductionMoney,
} from '../lib/production'

test('formats no-charge contribution value for production queue display', () => {
  assert.equal(formatProductionMoney(0, 'CAD'), 'CA$0.00')
  assert.equal(describeProductionContribution({
    contributionType: 'paid',
    paymentMethod: 'comped',
    totalCents: 0,
    currency: 'CAD',
  }), 'No-charge contribution: CA$0.00')
  assert.equal(describeProductionContribution({
    contributionType: 'donated',
    donatedAmountCents: 1250,
    currency: 'CAD',
  }), 'Donated production work: CA$12.50')
})

test('extracts latest PrintLab submission summary without leaking full metadata', () => {
  const summary = extractPrintLabSubmissionSummary({
    lastPrintLabSubmission: {
      status: 'failed',
      printerName: 'X1C',
      printLabJobId: 'pl-job-1',
      error: 'Model assets are available, but this file type is not queueable yet.',
      unrelatedSecret: 'do-not-return',
    },
  })

  assert.deepEqual(summary, {
    status: 'failed',
    printerName: 'X1C',
    printLabJobId: 'pl-job-1',
    error: 'Model assets are available, but this file type is not queueable yet.',
  })
})
