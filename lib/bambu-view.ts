import { NextResponse } from 'next/server'

export type BambuPrinter = {
  id: string
  name: string
  host?: string | null
  serial?: string | null
  go2rtc_src?: string | null
}

type BambuViewConfig = {
  baseUrl: string
  sessionCookie?: string
  authHeader?: string
}

function getConfig(): BambuViewConfig | null {
  const baseUrl = (process.env.BAMBU_VIEW_BASE_URL || '').trim().replace(/\/+$/, '')
  if (!baseUrl) return null
  const sessionCookie = (process.env.BAMBU_VIEW_SESSION_COOKIE || '').trim()
  const authHeader = (process.env.BAMBU_VIEW_AUTH_HEADER || '').trim()
  return { baseUrl, sessionCookie: sessionCookie || undefined, authHeader: authHeader || undefined }
}

export function bambuViewDisabledResponse() {
  return NextResponse.json({ enabled: false, error: 'Bambu View integration is not configured.' }, { status: 400 })
}

async function bambuFetch(path: string, init?: RequestInit) {
  const cfg = getConfig()
  if (!cfg) throw new Error('Bambu View is not configured')
  const url = `${cfg.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = new Headers(init?.headers)
  if (cfg.sessionCookie) headers.set('Cookie', cfg.sessionCookie)
  if (cfg.authHeader) headers.set('Authorization', cfg.authHeader)
  const res = await fetch(url, { ...init, headers, cache: 'no-store' })
  return res
}

async function bambuJson(path: string, init?: RequestInit) {
  const res = await bambuFetch(path, init)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw Object.assign(new Error(body?.error || `Bambu View request failed (${res.status})`), { status: res.status, payload: body })
  }
  return body
}

export async function fetchBambuPrinters(): Promise<BambuPrinter[]> {
  const data = await bambuJson('/api/printers')
  return Array.isArray(data?.printers) ? data.printers : []
}

export async function fetchBambuStatus(printerId?: string | null) {
  const query = printerId ? `?printer_id=${encodeURIComponent(printerId)}` : ''
  return bambuJson(`/data${query}`)
}

export async function sendBambuJobAction(printerId: string, action: 'pause' | 'resume' | 'stop' | 'start', payload?: Record<string, any>) {
  return bambuJson('/api/job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, printer_id: printerId, ...(payload || {}) }),
  })
}

export async function sendBambuPrint(printerId: string, gcodeFile: string, amsMapping?: Array<Record<string, any>>) {
  return bambuJson('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printer_id: printerId, gcode_file: gcodeFile, confirm: 'print', ams_mapping: amsMapping }),
  })
}

export async function fetchBambuSpools(printerId: string) {
  return bambuJson(`/api/spools?printer_id=${encodeURIComponent(printerId)}`)
}
