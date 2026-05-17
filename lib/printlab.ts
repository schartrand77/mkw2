import { NextResponse } from 'next/server'
import { normalizeServiceBaseUrl } from '@/lib/service-base-url'
import { getEffectiveSuiteRuntimeSettings } from '@/lib/suite-runtime'

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

async function getConfig(): Promise<PrintLabConfig | null> {
  const runtime = await getEffectiveSuiteRuntimeSettings([
    'printlabBaseUrl',
    'printlabSessionCookie',
    'printlabAuthHeader',
    'printlabApiKey',
  ])
  const baseUrl = normalizeServiceBaseUrl(runtime.printlabBaseUrl.value || resolveEnv('PRINTLAB_BASE_URL', 'BAMBU_VIEW_BASE_URL'))
  if (!baseUrl) return null
  const sessionCookie = runtime.printlabSessionCookie.value || resolveEnv('PRINTLAB_SESSION_COOKIE', 'BAMBU_VIEW_SESSION_COOKIE')
  const authHeader = runtime.printlabAuthHeader.value || resolveEnv('PRINTLAB_AUTH_HEADER', 'BAMBU_VIEW_AUTH_HEADER')
  const apiKey = runtime.printlabApiKey.value || resolveEnv('PRINTLAB_API_KEY', 'BAMBU_VIEW_API_KEY')
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
  return getConfig().then(Boolean)
}

export function printLabDisabledResponse() {
  return NextResponse.json({ enabled: false, error: 'PrintLab integration is not configured.' }, { status: 400 })
}

async function printLabFetch(path: string, init?: RequestInit) {
  const cfg = await getConfig()
  if (!cfg) throw new Error('PrintLab is not configured')
  const url = `${cfg.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = new Headers(init?.headers)
  if (cfg.sessionCookie) headers.set('Cookie', cfg.sessionCookie)
  if (cfg.authHeader) headers.set('Authorization', cfg.authHeader)
  if (cfg.apiKey && cfg.apiKeyHeader) headers.set(cfg.apiKeyHeader, cfg.apiKey)
  try {
    return await fetch(url, { ...init, headers, cache: 'no-store' })
  } catch (cause: any) {
    throw Object.assign(
      new Error(
        `Unable to reach PrintLab at ${cfg.baseUrl}. Confirm PRINTLAB_BASE_URL is reachable from the MakerWorks container, both containers are on the shared Docker network, and PrintLab is listening on the configured internal port.`,
      ),
      { status: 502, cause },
    )
  }
}

async function printLabJson(path: string, init?: RequestInit) {
  const res = await printLabFetch(path, init)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = typeof body?.error === 'string'
      ? body.error
      : typeof body?.error?.message === 'string'
        ? body.error.message
        : typeof body?.detail === 'string'
          ? body.detail
          : `PrintLab request failed (${res.status})`
    throw Object.assign(new Error(message), { status: res.status, payload: body })
  }
  return body
}

export async function fetchPrintLabPrinters(): Promise<PrintLabPrinter[]> {
  const data = await printLabJson('/api/printers')
  const printers = Array.isArray(data?.printers)
    ? data.printers
    : Array.isArray(data?.items)
      ? data.items
      : []
  return printers.map((printer: any) => ({
    id: String(printer?.id || ''),
    name: String(printer?.name || printer?.id || 'Printer'),
    host: printer?.host || printer?.ip_address || printer?.settings?.host || null,
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

export async function fetchPrintLabJobs(options?: { status?: string | null }) {
  const params = new URLSearchParams()
  const status = options?.status?.trim()
  if (status) params.set('status', status)
  const query = params.toString()
  const data = await printLabJson(`/api/jobs${query ? `?${query}` : ''}`)
  return Array.isArray(data?.items) ? data.items : []
}

export async function fetchPrintLabJob(jobId: string) {
  const id = jobId.trim()
  if (!id) throw Object.assign(new Error('PrintLab job ID is required.'), { status: 400 })
  const data = await printLabJson(`/api/jobs/${encodeURIComponent(id)}`)
  return data?.item ?? data
}

export async function fetchPrintLabSuccessfulGcodes() {
  const data = await printLabJson('/api/successful-gcodes')
  return Array.isArray(data?.items) ? data.items : []
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

export type PrintLabMakerWorksSubmitPayload = {
  model_id: string
  printer_id?: string | null
  idempotency_key: string
  source_job_id: string
  source_order_id: string
  start_at?: string | null
  plate_gcode?: string
  use_ams?: boolean
  ams_mapping?: number[] | null
  bed_type?: string
  timelapse?: boolean
  bed_leveling?: boolean
  flow_cali?: boolean
  vibration_cali?: boolean
  layer_inspect?: boolean
  route_only?: boolean
  metadata?: Record<string, unknown>
}

export async function submitPrintLabMakerWorksJob(payload: PrintLabMakerWorksSubmitPayload) {
  return printLabJson('/api/works/makerworks/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
