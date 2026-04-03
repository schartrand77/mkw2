import type { ReactNode } from 'react'

type Props = {
  name: string
  provider?: string | null
  externalId?: string | null
  metadata?: unknown
  status?: string | null
  active?: boolean
  lastSeenAt?: string | Date | null
  className?: string
  subtitle?: ReactNode
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isBambuProvider(provider?: string | null) {
  const raw = (provider || '').toLowerCase()
  return raw.includes('bambu') || raw.includes('printlab')
}

function resolveHost(metadata?: unknown): string | null {
  const record = asRecord(metadata)
  if (!record) return null
  return asString(record.host) || asString(record.ip) || asString(record.lan_ip)
}

function resolveSerial(metadata?: unknown): string | null {
  const record = asRecord(metadata)
  if (!record) return null
  return asString(record.serial)
}

function formatLastSeen(value?: string | Date | null): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function PrinterIdentity({
  name,
  provider,
  externalId,
  metadata,
  status,
  active,
  lastSeenAt,
  className = '',
  subtitle,
}: Props) {
  const isBambu = isBambuProvider(provider)
  const host = resolveHost(metadata)
  const serial = resolveSerial(metadata)
  const seen = formatLastSeen(lastSeenAt)

  return (
    <div className={`flex items-start gap-2 ${className}`.trim()}>
      <div className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${isBambu ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-200' : 'border-white/15 bg-white/5 text-slate-300'}`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8V4h12v4" />
          <path d="M4 9h16v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" />
          <path d="M8 14h8" />
          <path d="M8 18h8" />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
          {isBambu ? <span className="rounded-full border border-emerald-300/30 px-1.5 py-0.5 text-emerald-200">Bambu Lab</span> : null}
          {host ? <span>IP: {host}</span> : null}
          {externalId ? <span>ID: {externalId}</span> : null}
          {serial ? <span>SN: {serial}</span> : null}
          {status ? <span>Status: {status}</span> : null}
          {typeof active === 'boolean' ? <span>{active ? 'Active' : 'Inactive'}</span> : null}
          {seen ? <span>Seen: {seen}</span> : null}
        </div>
        {subtitle ? <div className="mt-1 text-xs text-slate-400">{subtitle}</div> : null}
      </div>
    </div>
  )
}
