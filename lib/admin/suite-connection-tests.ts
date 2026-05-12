import { normalizeServiceBaseUrl } from '@/lib/service-base-url'

export type SuiteConnectionService = 'printlab' | 'stockworks' | 'orderworks'

type ConnectionTestUrlOptions = {
  dockerRuntime?: boolean
}

export function buildHealthCheckUrl(baseUrl: string) {
  return `${baseUrl.trim().replace(/\/+$/, '')}/health`
}

export function buildConnectionTestUrl(baseUrl: string, options: ConnectionTestUrlOptions = {}) {
  const reachableBaseUrl = normalizeServiceBaseUrl(baseUrl, 'http://', options)
  return buildHealthCheckUrl(reachableBaseUrl)
}

export function buildConnectionTestHeaders(apiKey?: string | null) {
  const headers: Record<string, string> = {}
  const token = String(apiKey || '').trim()
  if (token) headers['X-API-Key'] = token
  return headers
}
