import { NextResponse } from 'next/server'
import { normalizeServiceBaseUrl } from '@/lib/service-base-url'

export type PrintLabPrinter = {
  id: string
  name: string
  host?: string | null
  serial?: string | null
  go2rtc_src?: string | null
}

export type PrintLabJobStatus =
  | 'pending_submission'
  | 'queued'
  | 'started'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'submit_failed'

export type PrintLabSubmitJobInput = {
  model_id: string
  printer_id?: string | null
  idempotency_key: string
  source_job_id?: string | null
  source_order_id?: string | null
  start_at?: string | null
  plate_gcode?: string | null
  use_ams?: boolean
  ams_mapping?: number[]
  bed_type?: string
  timelapse?: boolean
  bed_leveling?: boolean
  flow_cali?: boolean
  vibration_cali?: boolean
  layer_inspect?: boolean
  metadata?: Record<string, unknown>
}

export type PrintLabJobRecord = {
  id: string
  status: string
  printer_id?: string | null
  printer_name?: string | null
  queue_item_id?: string | null
  idempotency_key?: string | null
  source_job_id?: string | null
  source_order_id?: string | null
  model_id?: string | null
  model_name?: string | null
  file_path?: string | null
  file_name?: string | null
  created_at?: string | null
  updated_at?: string | null
  history?: unknown[]
  callback?: unknown
  metadata?: Record<string, unknown> | null
}

export type PrintLabJobCallbackPayload = {
  job_id: string
  status: Exclude<PrintLabJobStatus, 'pending_submission'>
  printer_id?: string | null
  printer_name?: string | null
  queue_item_id?: string | null
  successful_gcode_id?: string | null
  idempotency_key?: string | null
  source?: string | null
  source_job_id?: string | null
  source_order_id?: string | null
  model_id?: string | null
  model_name?: string | null
  model_url?: string | null
  download_url?: string | null
  file_path?: string | null
  file_name?: string | null
  plate_gcode?: string | null
  start_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  last_error?: string | null
  metadata?: Record<string, unknown> | null
  history?: unknown[]
  updated_at?: string | null
  created_at?: string | null
}

type PrintLabConfig = {
  baseUrl: string
  sessionCookie?: string
  authHeader?: string
  apiKey?: string
  apiKeyHeader?: string
}

export class PrintLabRequestError extends Error {
  status: number
  payload: any

  constructor(message: string, status: number, payload: any) {
    super(message)
    this.name = 'PrintLabRequestError'
    this.status = status
    this.payload = payload
  }
}

function resolveEnv(primary: string, legacy?: string) {
  const value = (process.env[primary] || '').trim()
  if (value) return value
  return legacy ? (process.env[legacy] || '').trim() : ''
}

function getConfig(): PrintLabConfig | null {
  const baseUrl = normalizeServiceBaseUrl(resolveEnv('PRINTLAB_BASE_URL', 'BAMBU_VIEW_BASE_URL'))
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

export function getPrintLabBaseUrl() {
  return getConfig()?.baseUrl || null
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
    throw new PrintLabRequestError(body?.error || `PrintLab request failed (${res.status})`, res.status, body)
  }
  return body
}

function coerceJobRecord(raw: any): PrintLabJobRecord {
  return {
    id: String(raw?.id || ''),
    status: String(raw?.status || ''),
    printer_id: raw?.printer_id || null,
    printer_name: raw?.printer_name || null,
    queue_item_id: raw?.queue_item_id || null,
    idempotency_key: raw?.idempotency_key || null,
    source_job_id: raw?.source_job_id || null,
    source_order_id: raw?.source_order_id || null,
    model_id: raw?.model_id || null,
    model_name: raw?.model_name || null,
    file_path: raw?.file_path || null,
    file_name: raw?.file_name || null,
    created_at: raw?.created_at || null,
    updated_at: raw?.updated_at || null,
    history: Array.isArray(raw?.history) ? raw.history : [],
    callback: raw?.callback,
    metadata: raw?.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : null,
  }
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

export async function submitPrintLabJob(payload: PrintLabSubmitJobInput): Promise<PrintLabJobRecord> {
  const data = await printLabJson('/api/works/makerworks/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return coerceJobRecord(data)
}

export async function getPrintLabJob(jobId: string): Promise<PrintLabJobRecord> {
  const data = await printLabJson(`/api/works/makerworks/jobs/${encodeURIComponent(jobId)}`)
  return coerceJobRecord(data)
}
