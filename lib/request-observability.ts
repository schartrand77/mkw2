import { NextResponse } from 'next/server'
import { captureError } from '@/lib/error-tracking'
import { getRequestContext, logEvent } from '@/lib/observability-logger'
import { incrementMetric, observeDurationMetric } from '@/lib/observability-metrics'

type RouteHandler<TReq extends Request = Request, TCtx = unknown> = (req: TReq, ctx: TCtx) => Promise<Response>

export function withRequestObservability<TReq extends Request = Request, TCtx = unknown>(
  handler: RouteHandler<TReq, TCtx>,
  options?: { routeName?: string },
): RouteHandler<TReq, TCtx> {
  return async (req: TReq, ctx: TCtx) => {
    const started = Date.now()
    const context = getRequestContext(req)
    const route = options?.routeName || context.route
    try {
      const response = await handler(req, ctx)
      const latencyMs = Date.now() - started
      const status = response.status
      const errorCode = status >= 400 ? status : null
      incrementMetric('api_requests_total', 1, { route, method: context.method, status })
      observeDurationMetric('api_request_latency_ms', latencyMs, { route, method: context.method, status })
      if (status >= 500) {
        incrementMetric('api_server_errors_total', 1, { route, method: context.method, status })
      }
      logEvent({
        event: 'http.request',
        route,
        method: context.method,
        status,
        latencyMs,
        userId: context.userId,
        orgId: context.orgId,
        requestId: context.requestId,
        errorCode,
      })
      return response
    } catch (err: any) {
      const latencyMs = Date.now() - started
      incrementMetric('api_requests_total', 1, { route, method: context.method, status: 500 })
      incrementMetric('api_server_errors_total', 1, { route, method: context.method, status: 500 })
      observeDurationMetric('api_request_latency_ms', latencyMs, { route, method: context.method, status: 500 })
      await captureError(err, {
        category: 'api_unhandled',
        route,
        method: context.method,
        requestId: context.requestId,
        userId: context.userId,
        orgId: context.orgId,
      })
      logEvent({
        level: 'error',
        event: 'http.request',
        route,
        method: context.method,
        status: 500,
        latencyMs,
        userId: context.userId,
        orgId: context.orgId,
        requestId: context.requestId,
        errorCode: err?.code || err?.name || 500,
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
