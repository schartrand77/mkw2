import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildProductionQueueClientSnapshot,
  describeProductionContribution,
  deriveOrderStatusFromPrintLabStatus,
  extractPrintLabSubmissionSummary,
  formatProductionMoney,
  mergePrintLabCallbackMetadata,
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

test('merges PrintLab callback state into production metadata', () => {
  const metadata = mergePrintLabCallbackMetadata({
    printLabSubmissions: [
      {
        printLabJobId: 'pl-job-1',
        status: 'queued',
        printerName: 'X1C',
      },
    ],
    lastPrintLabSubmission: {
      printLabJobId: 'pl-job-1',
      status: 'queued',
      printerName: 'X1C',
    },
  }, {
    job_id: 'pl-job-1',
    status: 'completed',
    printer_id: 'printer-1',
    printer_name: 'X1C',
    queue_item_id: 'queue-1',
    successful_gcode_id: 'gcode-1',
    completed_at: '2026-05-10T07:33:00.000Z',
    last_error: '',
  }, '2026-05-10T07:34:00.000Z')

  assert.deepEqual(extractPrintLabSubmissionSummary(metadata), {
    status: 'completed',
    printerName: 'X1C',
    printLabJobId: 'pl-job-1',
    error: null,
  })
  assert.equal((metadata.printLabSubmissions as any[]).length, 1)
  assert.equal((metadata.printLabSubmissions as any[])[0].successfulGcodeId, 'gcode-1')
})

test('maps PrintLab printer status to MakerWorks production status', () => {
  assert.equal(deriveOrderStatusFromPrintLabStatus('queued', 'queued'), 'queued')
  assert.equal(deriveOrderStatusFromPrintLabStatus('started', 'queued'), 'printing')
  assert.equal(deriveOrderStatusFromPrintLabStatus('completed', 'queued'), 'completed')
  assert.equal(deriveOrderStatusFromPrintLabStatus('failed', 'printing'), 'failed')
  assert.equal(deriveOrderStatusFromPrintLabStatus('cancelled', 'printing'), 'failed')
  assert.equal(deriveOrderStatusFromPrintLabStatus('submit_failed', 'queued'), 'failed')
  assert.equal(deriveOrderStatusFromPrintLabStatus('unknown', 'queued'), 'queued')
})

test('serializes PrintLab-backed production jobs for the admin job queue', () => {
  const snapshot = buildProductionQueueClientSnapshot({
    generatedAt: new Date('2026-05-10T07:34:00.000Z'),
    printers: [],
    capacityHoursPerDay: 8,
    queueHours: 1,
    orderWorks: { totalJobs: 0, sentJobs: 0, pendingJobs: 0, unpaidJobs: 0 },
    orders: [
      {
        id: 'order-1',
        orderNumber: 17,
        status: 'post_process',
        createdAt: new Date('2026-05-10T06:00:00.000Z'),
        customerName: 'techpunk',
        customerEmail: 'tech@example.com',
        paymentMethod: 'comped',
        paymentStatus: 'paid',
        totalCents: 0,
        currency: 'CAD',
        contributionType: 'paid',
        donatedAmountCents: 0,
        receiptStatus: 'none',
        contributionNotes: null,
        lineItems: [
          { modelTitle: 'Blanding Turtle Egg', material: 'PLA', quantity: 2, totalCents: 1000 },
        ],
        lastPrintLabSubmission: {
          status: 'completed',
          printerName: 'Bambu Lab',
          printLabJobId: 'pl-job-1',
          error: null,
        },
        paymentIntentId: null,
        orderWorksStatus: null,
        orderWorksLastError: null,
        printerId: null,
        printerName: null,
        failedAt: null,
        failureNote: null,
        totalHours: 1,
        queuePosition: 1,
        estimatedCompletionAt: new Date('2026-05-10T08:00:00.000Z'),
        etaConfidenceScore: 0.82,
      },
    ],
  })

  assert.equal(snapshot.totalCount, 1)
  assert.equal(snapshot.activeCount, 1)
  assert.equal(snapshot.jobs[0].orderLabel, 'MW-00017')
  assert.equal(snapshot.jobs[0].customerName, 'techpunk')
  assert.equal(snapshot.jobs[0].printLabStatus, 'completed')
  assert.equal(snapshot.jobs[0].legacyJobStatus, null)
})
