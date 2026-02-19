import { access, constants } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/db'
import { getInMemoryMetricsSnapshot } from '@/lib/observability-metrics'
import { storageRoot } from '@/lib/storage'

type DependencyStatus = 'ok' | 'warn' | 'fail' | 'skipped'

type DependencyCheck = {
  name: string
  status: DependencyStatus
  latencyMs?: number
  detail?: string
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

  const orderworksBase = (process.env.ORDERWORKS_BASE_URL || '').trim()
  checks.push(orderworksBase ? await checkHttp('orderworks', orderworksBase) : { name: 'orderworks', status: 'skipped', detail: 'ORDERWORKS_BASE_URL not configured' })

  const stockworksBase = (process.env.STOCKWORKS_BASE_URL || '').trim()
  checks.push(stockworksBase ? await checkHttp('stockworks', stockworksBase) : { name: 'stockworks', status: 'skipped', detail: 'STOCKWORKS_BASE_URL not configured' })

  const bambuViewBase = (process.env.BAMBU_VIEW_BASE_URL || '').trim()
  checks.push(bambuViewBase ? await checkHttp('bambu_view', bambuViewBase) : { name: 'bambu_view', status: 'skipped', detail: 'BAMBU_VIEW_BASE_URL not configured' })

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

export async function getOperationalMetrics() {
  const [oldestPendingJob, pendingJobs, sentJobs, failedPaymentJobs] = await Promise.all([
    prisma.jobForm.findFirst({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.jobForm.count({ where: { status: 'pending' } }),
    prisma.jobForm.count({ where: { status: 'sent' } }),
    prisma.jobForm.count({ where: { paymentStatus: { in: ['failed', 'canceled', 'cancelled'] } } }),
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

  return {
    queue: {
      pendingJobs,
      queueAgeSec,
      oldestPendingAt: oldestPendingJob?.createdAt?.toISOString() || null,
    },
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
