import { NextResponse } from 'next/server'

export type PrintLabPrinter = {
  id: string
  name: string
  host?: string | null
  serial?: string | null
  go2rtc_src?: string | null
}

type PrintLabConfig = {
  baseUrl: string
  sessionCookie?: string
  authHeader?: string
  apiKey?: string
  apiKeyHeader?: string
}

function resolveEnv(primary: string, legacy?: string) {
  const value = (process.env[primary] || '').trim()
  if (value) return value
  return legacy ? (process.env[legacy] || '').trim() : ''
}

function getConfig(): PrintLabConfig | null {
  const baseUrl = resolveEnv('PRINTLAB_BASE_URL', 'BAMBU_VIEW_BASE_URL').replace(/\/+$/, '')
  if (!baseUrl) return null
  const sessionCookie = resolveEnv('PRINTLAB_SESSION_COOKIE', 'BAMBU_VIEW_SESSION_COOKIE')
  const authHeader = resolveEnv('PRINTLAB_AUTH_HEADER', 'BAMBU_VIEW_AUTH_HEADER')
  const apiKey = resolveEnv('PRINTLAB_API_KEY', 'BAMBU_VIEW_API_KEY')
  const apiKeyHeader = resolveEnv('PRINTLAB_API_KEY_HEADER', 'BAMBU_VIEW_API_KEY_HEADER') || 'X-API-Key'
  return {
    baseUrl,
    sessionCookie: sessionCookie || undefined,
    authHeader: authHeader || undefined,
    apiKey: apiKey || undefined,
    apiKeyHeader: apiKey ? apiKeyHeader : undefined,
  }
}

export function isPrintLabConfigured() {
  return Boolean(getConfig())
}

export function printLabDisabledResponse() {
  return NextResponse.json({ enabled: false, error: 'PrintLab integration is not configured.' }, { status: 400 })
}

async function printLabFetch(path: string, init?: RequestInit) {
  const cfg = getConfig()
  if (!cfg) throw new Error('PrintLab is not configured')
  const url = `${cfg.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = new Headers(init?.headers)
  if (cfg.sessionCookie) headers.set('Cookie', cfg.sessionCookie)
  if (cfg.authHeader) headers.set('Authorization', cfg.authHeader)
  if (cfg.apiKey && cfg.apiKeyHeader) headers.set(cfg.apiKeyHeader, cfg.apiKey)
  return fetch(url, { ...init, headers, cache: 'no-store' })
}

async function printLabJson(path: string, init?: RequestInit) {
  const res = await printLabFetch(path, init)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw Object.assign(new Error(body?.error || `PrintLab request failed (${res.status})`), { status: res.status, payload: body })
  }
  return body
}

export async function fetchPrintLabPrinters(): Promise<PrintLabPrinter[]> {
  const data = await printLabJson('/api/printers')
  const printers = Array.isArray(data?.printers) ? data.printers : []
  return printers.map((printer: any) => ({
    id: String(printer?.id || ''),
    name: String(printer?.name || printer?.id || 'Printer'),
    host: printer?.host || printer?.ip_address || null,
    serial: printer?.serial || null,
    go2rtc_src: printer?.go2rtc_src || null,
  })).filter((printer: PrintLabPrinter) => Boolean(printer.id))
}

export async function fetchPrintLabStatus(printerId?: string | null) {
  if (printerId) {
    return printLabJson(`/api/printers/${encodeURIComponent(printerId)}/state`)
  }
  return printLabJson('/api/state')
}

export async function sendPrintLabJobAction(printerId: string, action: 'pause' | 'resume' | 'stop') {
  return printLabJson(`/api/printers/${encodeURIComponent(printerId)}/actions/${encodeURIComponent(action)}`, {
    method: 'POST',
  })
}

export async function fetchPrintLabSpools(printerId: string) {
  const status = await fetchPrintLabStatus(printerId)
  const slots = Array.isArray(status?.ams?.slots) ? status.ams.slots : []
  return {
    printer_id: printerId,
    spools: slots.map((slot: any) => ({
      id: `${printerId}-${slot?.index ?? ''}`,
      index: slot?.index ?? null,
      name: slot?.name || null,
      type: slot?.type || null,
      color_hex: slot?.color_hex || null,
      remain_percent: typeof slot?.remain_percent === 'number' ? slot.remain_percent : null,
      empty: Boolean(slot?.empty),
      active: Boolean(slot?.active),
    })),
  }
}
