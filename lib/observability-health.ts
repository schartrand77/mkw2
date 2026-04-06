import { access, constants } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/db'
import { getInMemoryMetricsSnapshot } from '@/lib/observability-metrics'
import { storageRoot } from '@/lib/storage'
import { normalizeServiceBaseUrl } from '@/lib/service-base-url'

type DependencyStatus = 'ok' | 'warn' | 'fail' | 'skipped'

type DependencyCheck = {
  name: string
  status: DependencyStatus
  latencyMs?: number
  detail?: string
}

type RuntimeSnapshot = ReturnType<typeof getInMemoryMetricsSnapshot>

export type ReleaseHealthStatus = 'ok' | 'warn' | 'fail'

type ReleaseHealthSlo = {
  key: string
  label: string
  status: ReleaseHealthStatus
  summary: string
  target: string
  metrics: Record<string, number | string | null>
}

export type ReleaseHealthSnapshot = {
  generatedAt: string
  status: ReleaseHealthStatus
  alerts: Array<{ severity: ReleaseHealthStatus; area: string; message: string }>
  dependencies: Awaited<ReturnType<typeof runDependencyChecks>>
  slos: ReleaseHealthSlo[]
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function checkHttp(name: string, url: string, timeoutMs = 3000, init?: RequestInit): Promise<DependencyCheck> {
  const started = Date.now()
  try {
    const res = await withTimeout(fetch(url, { method: 'GET', cache: 'no-store', ...init }), timeoutMs)
    const latencyMs = Date.now() - started
    if (res.status >= 500) {
      return { name, status: 'fail', latencyMs, detail: `HTTP ${res.status}` }
    }
    if (res.status >= 400) {
      return { name, status: 'warn', latencyMs, detail: `HTTP ${res.status}` }
    }
    return { name, status: 'ok', latencyMs, detail: `HTTP ${res.status}` }
  } catch (err: any) {
    return { name, status: 'fail', latencyMs: Date.now() - started, detail: err?.message || 'Request failed' }
  }
}

export async function runDependencyChecks() {
  const checks: DependencyCheck[] = []

  {
    const started = Date.now()
    try {
      await prisma.$queryRaw`SELECT 1`
      checks.push({ name: 'database', status: 'ok', latencyMs: Date.now() - started })
    } catch (err: any) {
      checks.push({ name: 'database', status: 'fail', latencyMs: Date.now() - started, detail: err?.message || 'DB check failed' })
    }
  }

  {
    const started = Date.now()
    const root = storageRoot()
    const backupsPath = path.join(root, 'backups')
    try {
      await access(root, constants.F_OK | constants.R_OK | constants.W_OK)
      await access(backupsPath, constants.F_OK | constants.R_OK).catch(() => undefined)
      checks.push({ name: 'storage', status: 'ok', latencyMs: Date.now() - started, detail: root })
    } catch (err: any) {
      checks.push({ name: 'storage', status: 'fail', latencyMs: Date.now() - started, detail: err?.message || root })
    }
  }

  const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim()
  if (stripeKey) {
    checks.push(await checkHttp(
      'stripe_api',
      'https://api.stripe.com/v1/account',
      3000,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    ))
  } else {
    checks.push({ name: 'stripe_api', status: 'skipped', detail: 'STRIPE_SECRET_KEY not configured' })
  }

  const orderworksBase = normalizeServiceBaseUrl(process.env.ORDERWORKS_BASE_URL)
  checks.push(orderworksBase ? await checkHttp('orderworks', orderworksBase) : { name: 'orderworks', status: 'skipped', detail: 'ORDERWORKS_BASE_URL not configured' })

  const stockworksBase = normalizeServiceBaseUrl(process.env.STOCKWORKS_BASE_URL)
  checks.push(stockworksBase ? await checkHttp('stockworks', stockworksBase) : { name: 'stockworks', status: 'skipped', detail: 'STOCKWORKS_BASE_URL not configured' })

  const printLabBase = normalizeServiceBaseUrl(process.env.PRINTLAB_BASE_URL || process.env.BAMBU_VIEW_BASE_URL || '')
  checks.push(printLabBase ? await checkHttp('printlab', printLabBase) : { name: 'printlab', status: 'skipped', detail: 'PRINTLAB_BASE_URL not configured' })

  const failing = checks.filter((entry) => entry.status === 'fail').length
  const warning = checks.filter((entry) => entry.status === 'warn').length
  const ok = failing === 0

  return {
    ok,
    summary: {
      total: checks.length,
      passing: checks.filter((entry) => entry.status === 'ok').length,
      failing,
      warning,
      skipped: checks.filter((entry) => entry.status === 'skipped').length,
    },
    checks,
  }
}

function asSeverityRank(status: ReleaseHealthStatus) {
  if (status === 'fail') return 2
  if (status === 'warn') return 1
  return 0
}

function pickHigherStatus(a: ReleaseHealthStatus, b: ReleaseHealthStatus): ReleaseHealthStatus {
  return asSeverityRank(a) >= asSeverityRank(b) ? a : b
}

function getCounterTotal(
  runtime: RuntimeSnapshot,
  name: string,
  predicate?: (labels: Record<string, string>) => boolean,
) {
  return runtime.counters
    .filter((entry) => entry.name === name)
    .filter((entry) => (predicate ? predicate(entry.labels) : true))
    .reduce((sum, entry) => sum + entry.value, 0)
}

function getRequestStatsForRoute(runtime: RuntimeSnapshot, route: string) {
  const requests = runtime.counters
    .filter((entry) => entry.name === 'api_requests_total')
    .filter((entry) => entry.labels.route === route)
  const total = requests.reduce((sum, entry) => sum + entry.value, 0)
  const healthy = requests
    .filter((entry) => Number(entry.labels.status || 0) < 500)
    .reduce((sum, entry) => sum + entry.value, 0)
  const serverErrors = requests
    .filter((entry) => Number(entry.labels.status || 0) >= 500)
    .reduce((sum, entry) => sum + entry.value, 0)
  const duration = runtime.durations.find((entry) => entry.name === 'api_request_latency_ms' && entry.labels.route === route) || null
  return {
    total,
    healthy,
    serverErrors,
    availabilityPct: total > 0 ? Number(((healthy / total) * 100).toFixed(3)) : null,
    avgMs: duration?.avgMs ?? null,
    p95Ms: (duration as any)?.p95Ms ?? null,
  }
}

function describePercent(value: number | null, fractionDigits = 2) {
  if (value == null || !Number.isFinite(value)) return '--'
  return `${value.toFixed(fractionDigits)}%`
}

function describeMs(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '--'
  return `${value.toFixed(0)} ms`
}

function describeHours(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '--'
  return `${value.toFixed(1)}h`
}

export function buildReleaseHealthSnapshot(args: {
  runtime: RuntimeSnapshot
  operational: Awaited<ReturnType<typeof getOperationalMetrics>>
  dependencies: Awaited<ReturnType<typeof runDependencyChecks>>
}): ReleaseHealthSnapshot {
  const { runtime, operational, dependencies } = args
  const slos: ReleaseHealthSlo[] = []
  const alerts: ReleaseHealthSnapshot['alerts'] = []

  const checkout = getRequestStatsForRoute(runtime, '/api/checkout')
  let checkoutStatus: ReleaseHealthStatus = 'ok'
  if (checkout.total === 0) {
    checkoutStatus = 'warn'
  } else if ((checkout.availabilityPct ?? 100) < 99.5 || (checkout.p95Ms ?? 0) > 2500) {
    checkoutStatus = 'fail'
  } else if ((checkout.availabilityPct ?? 100) < 99.9 || (checkout.p95Ms ?? 0) > 1500) {
    checkoutStatus = 'warn'
  }
  slos.push({
    key: 'checkout_api',
    label: 'Checkout API',
    status: checkoutStatus,
    summary: checkout.total === 0
      ? 'No checkout traffic recorded since process start.'
      : `${describePercent(checkout.availabilityPct, 3)} availability, ${describeMs(checkout.p95Ms)} p95 latency.`,
    target: 'Availability >= 99.9%, p95 <= 1500 ms',
    metrics: {
      requests: checkout.total,
      availabilityPct: checkout.availabilityPct,
      p95Ms: checkout.p95Ms,
      serverErrors: checkout.serverErrors,
    },
  })
  if (checkoutStatus !== 'ok') {
    alerts.push({
      severity: checkoutStatus,
      area: 'Checkout API',
      message: checkout.total === 0
        ? 'No checkout API samples recorded yet.'
        : `Checkout API is outside target: availability ${describePercent(checkout.availabilityPct, 3)}, p95 ${describeMs(checkout.p95Ms)}.`,
    })
  }

  const callbackSuccess = getCounterTotal(runtime, 'job_webhook_success_total')
  const callbackFailure = getCounterTotal(runtime, 'job_webhook_failure_total')
  const callbackTotal = callbackSuccess + callbackFailure
  const callbackLatencyCandidates = [
    getRequestStatsForRoute(runtime, '/api/printlab/jobs/[jobId]'),
    getRequestStatsForRoute(runtime, '/api/makerworks/jobs'),
  ].filter((entry) => entry.total > 0)
  const callbackP95 = callbackLatencyCandidates.length > 0
    ? Math.max(...callbackLatencyCandidates.map((entry) => entry.p95Ms || 0))
    : null
  const callbackSuccessRate = callbackTotal > 0 ? Number(((callbackSuccess / callbackTotal) * 100).toFixed(3)) : null
  let callbackStatus: ReleaseHealthStatus = 'ok'
  if (callbackTotal === 0) {
    callbackStatus = 'warn'
  } else if ((callbackSuccessRate ?? 100) < 99 || (callbackP95 ?? 0) > 3000) {
    callbackStatus = 'fail'
  } else if ((callbackSuccessRate ?? 100) < 99.9 || (callbackP95 ?? 0) > 1000) {
    callbackStatus = 'warn'
  }
  slos.push({
    key: 'job_callbacks',
    label: 'Job callback processing',
    status: callbackStatus,
    summary: callbackTotal === 0
      ? 'No callback traffic recorded since process start.'
      : `${describePercent(callbackSuccessRate, 3)} success, ${describeMs(callbackP95)} p95 latency.`,
    target: 'Success >= 99.9%, p95 <= 1000 ms',
    metrics: {
      callbacks: callbackTotal,
      successRatePct: callbackSuccessRate,
      p95Ms: callbackP95,
      failures: callbackFailure,
    },
  })
  if (callbackStatus !== 'ok') {
    alerts.push({
      severity: callbackStatus,
      area: 'Job callbacks',
      message: callbackTotal === 0
        ? 'No webhook callback samples recorded yet.'
        : `Callback processing is outside target: success ${describePercent(callbackSuccessRate, 3)}, p95 ${describeMs(callbackP95)}.`,
    })
  }

  const queueAgeHours = operational.queue.queueAgeSec > 0 ? Number((operational.queue.queueAgeSec / 3600).toFixed(2)) : 0
  const queueBacklogDays = operational.capacityHoursPerDay > 0
    ? Number((operational.queueHours / operational.capacityHoursPerDay).toFixed(2))
    : null
  let queueStatus: ReleaseHealthStatus = 'ok'
  if ((queueAgeHours > 8) || ((queueBacklogDays ?? 0) > 2)) {
    queueStatus = 'fail'
  } else if ((queueAgeHours > 4) || ((queueBacklogDays ?? 0) > 1)) {
    queueStatus = 'warn'
  }
  slos.push({
    key: 'queue_processing',
    label: 'Queue processing',
    status: queueStatus,
    summary: `${operational.queue.pendingJobs} pending jobs, ${queueAgeHours.toFixed(1)}h oldest age, ${describeHours(queueBacklogDays != null ? queueBacklogDays * 24 : null)} backlog.`,
    target: 'Oldest queue age <= 4h, backlog <= 1 day of capacity',
    metrics: {
      pendingJobs: operational.queue.pendingJobs,
      oldestQueueAgeHours: queueAgeHours,
      backlogDays: queueBacklogDays,
      queueHours: operational.queueHours,
      capacityHoursPerDay: operational.capacityHoursPerDay,
    },
  })
  if (queueStatus !== 'ok') {
    alerts.push({
      severity: queueStatus,
      area: 'Queue processing',
      message: `Queue is outside target: oldest age ${queueAgeHours.toFixed(1)}h, backlog ${queueBacklogDays?.toFixed(2) ?? '--'} day(s).`,
    })
  }

  const dependencyStatus: ReleaseHealthStatus = dependencies.summary.failing > 0
    ? 'fail'
    : dependencies.summary.warning > 0
      ? 'warn'
      : 'ok'
  if (dependencyStatus !== 'ok') {
    alerts.push({
      severity: dependencyStatus,
      area: 'Dependencies',
      message: `${dependencies.summary.failing} failing, ${dependencies.summary.warning} warning dependency checks.`,
    })
  }

  const status = [checkoutStatus, callbackStatus, queueStatus, dependencyStatus].reduce<ReleaseHealthStatus>(
    (current, next) => pickHigherStatus(current, next),
    'ok',
  )

  return {
    generatedAt: new Date().toISOString(),
    status,
    alerts: alerts.sort((a, b) => asSeverityRank(b.severity) - asSeverityRank(a.severity)),
    dependencies,
    slos,
  }
}

export async function getOperationalMetrics() {
  const [oldestPendingJob, pendingJobs, sentJobs, failedPaymentJobs, printerCapacity] = await Promise.all([
    prisma.jobForm.findFirst({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.jobForm.count({ where: { status: 'pending' } }),
    prisma.jobForm.count({ where: { status: 'sent' } }),
    prisma.jobForm.count({ where: { paymentStatus: { in: ['failed', 'canceled', 'cancelled'] } } }),
    prisma.printer.findMany({
      where: { active: true, status: { in: ['available', 'printing'] } },
      select: { dailyCapacityHours: true },
    }),
  ])
  const inMemory = getInMemoryMetricsSnapshot()
  const startedCheckouts = inMemory.counters
    .filter((entry) => entry.name === 'checkout_started_total')
    .reduce((sum, entry) => sum + entry.value, 0)
  const committedCheckouts = inMemory.counters
    .filter((entry) => entry.name === 'checkout_committed_total')
    .reduce((sum, entry) => sum + entry.value, 0)
  const paymentFailures = inMemory.counters
    .filter((entry) => entry.name === 'payment_failures_total')
    .reduce((sum, entry) => sum + entry.value, 0)
  const jobFailureEvents = inMemory.counters
    .filter((entry) => entry.name === 'job_webhook_failure_total')
    .reduce((sum, entry) => sum + entry.value, 0)

  const now = Date.now()
  const queueAgeSec = oldestPendingJob?.createdAt ? Math.max(0, Math.round((now - oldestPendingJob.createdAt.getTime()) / 1000)) : 0
  const capacityHoursPerDay = Number(
    printerCapacity
      .reduce((sum, printer) => sum + (Number.isFinite(printer.dailyCapacityHours) ? printer.dailyCapacityHours : 0), 0)
      .toFixed(2),
  )
  const queueHoursApprox = pendingJobs * 1.5

  return {
    queue: {
      pendingJobs,
      queueAgeSec,
      oldestPendingAt: oldestPendingJob?.createdAt?.toISOString() || null,
    },
    queueHours: Number(queueHoursApprox.toFixed(2)),
    capacityHoursPerDay,
    jobs: {
      success: sentJobs,
      failed: jobFailureEvents,
    },
    checkout: {
      started: startedCheckouts,
      committed: committedCheckouts,
      conversionRate: startedCheckouts > 0 ? Number((committedCheckouts / startedCheckouts).toFixed(4)) : null,
    },
    payments: {
      failures: failedPaymentJobs + paymentFailures,
    },
  }
}

export async function getReleaseHealthSnapshot() {
  const [runtime, operational, dependencies] = await Promise.all([
    Promise.resolve(getInMemoryMetricsSnapshot()),
    getOperationalMetrics(),
    runDependencyChecks(),
  ])
  return buildReleaseHealthSnapshot({ runtime, operational, dependencies })
}
