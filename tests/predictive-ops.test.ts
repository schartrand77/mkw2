import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPrinterDowntimeRisks,
  buildSlaRiskWarnings,
  buildSpoolDepletionForecast,
} from '../lib/predictive-ops'

test('spool depletion forecast flags near-term depletion with confidence windows', () => {
  const result = buildSpoolDepletionForecast({
    inventory: [
      {
        id: 11,
        quantity_grams: 900,
        reorder_level: 300,
        location: 'Rack A',
        material: {
          id: 1,
          name: 'PLA Signal Red',
          filament_type: 'PLA',
          color: 'Red',
        },
      },
    ],
    queuedUsageByItem: new Map([[11, 500]]),
    wasteReport: [
      {
        material: 'PLA',
        estimatedGrams: 1800,
        actualGrams: 2100,
        varianceGrams: 300,
        coverageOrders: 5,
        totalOrders: 5,
      },
    ],
    historyDays: 30,
  })

  assert.equal(result.length, 1)
  assert.equal(result[0]?.risk === 'high' || result[0]?.risk === 'critical' || result[0]?.risk === 'medium', true)
  assert.equal(result[0]?.projectedRemainingGrams, 400)
  assert.equal(result[0]?.confidenceWindowDays.expected != null, true)
  assert.equal(result[0]?.notes.some((note) => /reserved by queued work/i.test(note)), true)
})

test('downtime risk scoring escalates stale and overdue printers', () => {
  const now = new Date('2026-04-06T18:00:00.000Z')
  const result = buildPrinterDowntimeRisks([
    {
      id: 'printer-risky',
      name: 'Risky Printer',
      status: 'available',
      active: true,
      dailyCapacityHours: 8,
      utilization: [
        { date: '2026-04-05', hours: 8, capacity: 8, utilization: 1 },
        { date: '2026-04-06', hours: 7.5, capacity: 8, utilization: 0.94 },
      ],
      successRate: 0.81,
      mtbfHours: 18,
      failures: 4,
      completed: 17,
      lastSeenAt: new Date('2026-04-06T04:00:00.000Z'),
      lastMaintenanceAt: new Date('2026-03-20T00:00:00.000Z'),
      maintenanceIntervalHours: 40,
      maintenanceNotes: null,
      provider: 'printlab',
      externalId: 'risky',
      metadata: null,
    },
  ], now)

  assert.equal(result[0]?.risk, 'critical')
  assert.equal(result[0]?.topSignals.some((signal) => /Heartbeat stale/i.test(signal)), true)
  assert.equal((result[0]?.maintenanceOverdueHours || 0) > 0, true)
})

test('sla early warnings surface queue pressure and low-confidence orders', () => {
  const createdAt = new Date(Date.now() - (72 * 60 * 60 * 1000))
  const estimatedCompletionAt = new Date(Date.now() + (96 * 60 * 60 * 1000))
  const result = buildSlaRiskWarnings({
    snapshot: {
      generatedAt: new Date(),
      printers: [],
      capacityHoursPerDay: 8,
      queueHours: 28,
      orderWorks: {
        totalJobs: 3,
        sentJobs: 2,
        pendingJobs: 1,
        unpaidJobs: 0,
      },
      orders: [
        {
          id: 'order-risk',
          orderNumber: 101,
          status: 'queued',
          createdAt,
          totalHours: 6,
          queuePosition: 7,
          estimatedCompletionAt,
          etaConfidenceScore: 0.51,
          paymentIntentId: null,
          orderWorksStatus: 'sent',
          orderWorksLastError: 'callback timeout',
          printerId: null,
          printerName: null,
          failedAt: null,
          failureNote: null,
        },
      ],
    },
    forecast: {
      range: { historyDays: 56, horizonDays: 30 },
      history: [],
      forecast: Array.from({ length: 7 }, (_, idx) => ({
        date: `2026-04-${String(idx + 7).padStart(2, '0')}`,
        expectedOrders: 2,
        expectedRevenueCents: 10000,
        confidence: 'medium' as const,
      })),
      summary: {
        averageOrdersPerDay: 2,
        averageRevenuePerDayCents: 10000,
      },
    },
  })

  assert.equal(result.summary.atRiskOrders, 1)
  assert.equal(result.summary.projectedBacklogDays != null, true)
  assert.equal(result.warnings[0]?.risk === 'high' || result.warnings[0]?.risk === 'critical', true)
  assert.equal(result.warnings[0]?.reasons.some((reason) => /Projected backlog/i.test(reason)), true)
})
