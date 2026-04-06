import assert from 'node:assert/strict'
import test from 'node:test'

import { buildReleaseHealthSnapshot } from '../lib/observability-health'

test('buildReleaseHealthSnapshot reports healthy release status when targets are met', () => {
  const snapshot = buildReleaseHealthSnapshot({
    runtime: {
      uptimeSec: 120,
      counters: [
        { name: 'api_requests_total', labels: { route: '/api/checkout', status: '200', method: 'POST' }, value: 100 },
        { name: 'job_webhook_success_total', labels: {}, value: 50 },
      ],
      durations: [
        { name: 'api_request_latency_ms', labels: { route: '/api/checkout', status: '200', method: 'POST' }, count: 100, totalMs: 24000, minMs: 90, maxMs: 600, avgMs: 240, p95Ms: 850 },
        { name: 'api_request_latency_ms', labels: { route: '/api/printlab/jobs/[jobId]', status: '200', method: 'POST' }, count: 50, totalMs: 10000, minMs: 80, maxMs: 500, avgMs: 200, p95Ms: 700 },
      ],
    },
    operational: {
      queue: {
        pendingJobs: 3,
        queueAgeSec: 1800,
        oldestPendingAt: new Date().toISOString(),
      },
      queueHours: 6,
      capacityHoursPerDay: 24,
      jobs: { success: 10, failed: 0 },
      checkout: { started: 15, committed: 12, conversionRate: 0.8 },
      payments: { failures: 0 },
    },
    dependencies: {
      ok: true,
      summary: { total: 3, passing: 3, failing: 0, warning: 0, skipped: 0 },
      checks: [
        { name: 'database', status: 'ok', latencyMs: 12 },
        { name: 'storage', status: 'ok', latencyMs: 5 },
        { name: 'printlab', status: 'ok', latencyMs: 40 },
      ],
    },
  })

  assert.equal(snapshot.status, 'ok')
  assert.equal(snapshot.alerts.length, 0)
  assert.equal(snapshot.slos.every((entry) => entry.status === 'ok'), true)
})

test('buildReleaseHealthSnapshot raises fail alerts when callback and queue targets are breached', () => {
  const snapshot = buildReleaseHealthSnapshot({
    runtime: {
      uptimeSec: 60,
      counters: [
        { name: 'api_requests_total', labels: { route: '/api/checkout', status: '500', method: 'POST' }, value: 2 },
        { name: 'api_requests_total', labels: { route: '/api/checkout', status: '200', method: 'POST' }, value: 18 },
        { name: 'job_webhook_success_total', labels: {}, value: 90 },
        { name: 'job_webhook_failure_total', labels: { reason: 'printlab_invalid_signature' }, value: 5 },
      ],
      durations: [
        { name: 'api_request_latency_ms', labels: { route: '/api/checkout', status: '200', method: 'POST' }, count: 20, totalMs: 80000, minMs: 300, maxMs: 4500, avgMs: 4000, p95Ms: 3200 },
        { name: 'api_request_latency_ms', labels: { route: '/api/printlab/jobs/[jobId]', status: '200', method: 'POST' }, count: 95, totalMs: 150000, minMs: 100, maxMs: 5000, avgMs: 1578, p95Ms: 3500 },
      ],
    },
    operational: {
      queue: {
        pendingJobs: 22,
        queueAgeSec: 10 * 3600,
        oldestPendingAt: new Date().toISOString(),
      },
      queueHours: 60,
      capacityHoursPerDay: 24,
      jobs: { success: 1, failed: 5 },
      checkout: { started: 30, committed: 20, conversionRate: 0.67 },
      payments: { failures: 3 },
    },
    dependencies: {
      ok: false,
      summary: { total: 3, passing: 1, failing: 1, warning: 1, skipped: 0 },
      checks: [
        { name: 'database', status: 'ok', latencyMs: 12 },
        { name: 'storage', status: 'warn', latencyMs: 5, detail: 'Slow I/O' },
        { name: 'printlab', status: 'fail', latencyMs: 40, detail: 'HTTP 503' },
      ],
    },
  })

  assert.equal(snapshot.status, 'fail')
  assert.equal(snapshot.alerts.some((entry) => entry.area === 'Checkout API' && entry.severity === 'fail'), true)
  assert.equal(snapshot.alerts.some((entry) => entry.area === 'Job callbacks' && entry.severity === 'fail'), true)
  assert.equal(snapshot.alerts.some((entry) => entry.area === 'Queue processing' && entry.severity === 'fail'), true)
  assert.equal(snapshot.alerts.some((entry) => entry.area === 'Dependencies' && entry.severity === 'fail'), true)
})
