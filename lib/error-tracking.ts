import { logEvent } from '@/lib/observability-logger'
import { incrementMetric } from '@/lib/observability-metrics'

let sentryModulePromise: Promise<any | null> | null = null

async function loadSentry() {
  if (sentryModulePromise) return sentryModulePromise
  const sentryModuleName = ['@sentry', 'nextjs'].join('/')
  const runtimeImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>
  sentryModulePromise = runtimeImport(sentryModuleName).catch(() => null)
  return sentryModulePromise
}

type ErrorContext = {
  category?: string
  route?: string
  method?: string
  requestId?: string | null
  userId?: string | null
  orgId?: string | null
  status?: number
  [key: string]: unknown
}

export async function captureError(error: unknown, context: ErrorContext = {}) {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error')
  incrementMetric('errors_total', 1, { category: context.category || 'unknown', route: context.route || 'unknown' })
  logEvent({
    level: 'error',
    event: 'error.capture',
    message: err.message,
    stack: err.stack,
    ...context,
    errorName: err.name,
  })

  const dsnConfigured = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
  if (!dsnConfigured) return
  const sentry = await loadSentry()
  if (!sentry?.captureException) return
  sentry.captureException(err, {
    tags: {
      category: context.category || 'unknown',
      route: String(context.route || ''),
      method: String(context.method || ''),
    },
    extra: context,
  })
}
