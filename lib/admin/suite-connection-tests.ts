export type SuiteConnectionService = 'printlab' | 'stockworks' | 'orderworks'

export function buildHealthCheckUrl(baseUrl: string) {
  return `${baseUrl.trim().replace(/\/+$/, '')}/health`
}

export function buildConnectionTestHeaders(apiKey?: string | null) {
  const headers: Record<string, string> = {}
  const token = String(apiKey || '').trim()
  if (token) headers['X-API-Key'] = token
  return headers
}
