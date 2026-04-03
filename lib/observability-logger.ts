import { verifyToken } from '@/lib/auth'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type BaseLogEvent = {
  ts?: string
  level?: LogLevel
  event: string
  message?: string
  [key: string]: unknown
}

function shouldPrettyPrint() {
  return process.env.NODE_ENV !== 'production'
}

export function logEvent(payload: BaseLogEvent) {
  const event = {
    ts: payload.ts || new Date().toISOString(),
    level: payload.level || 'info',
    ...payload,
  }
  if (shouldPrettyPrint()) {
    const { level, event: eventType, message, ...rest } = event
    const prefix = `[${String(level).toUpperCase()}] ${String(eventType)}`
    if (message) {
      console.log(prefix, message, Object.keys(rest).length > 0 ? rest : '')
      return
    }
    console.log(prefix, Object.keys(rest).length > 0 ? rest : '')
    return
  }
  console.log(JSON.stringify(event))
}

export function parseUserIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') || ''
  const tokenMatch = cookieHeader.match(/(?:^|;\\s*)mwv2_token=([^;]+)/)
  if (!tokenMatch?.[1]) return null
  const token = decodeURIComponent(tokenMatch[1])
  const payload = verifyToken(token)
  return payload?.sub || null
}

export function getRequestContext(req: Request) {
  const url = new URL(req.url)
  const requestId = req.headers.get('x-request-id') || req.headers.get('x-correlation-id') || null
  const orgId = req.headers.get('x-org-id') || null
  return {
    method: req.method,
    route: url.pathname,
    requestId,
    userId: parseUserIdFromRequest(req),
    orgId,
  }
}
