"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type CurrentPrintLabLink = {
  status?: string | null
  printerName?: string | null
  printLabJobId?: string | null
  error?: string | null
}

type Props = {
  orderId: string
  current?: CurrentPrintLabLink | null
}

type SearchKind = 'jobs' | 'successful-gcodes'
type PasteMode = 'auto' | 'submitted_job' | 'successful_gcode'
type PanelMode = 'search' | 'paste' | 'manual'

function recordTitle(item: any) {
  return item?.model_name || item?.modelName || item?.file_name || item?.fileName || item?.id || 'PrintLab record'
}

function recordMeta(item: any) {
  return [
    item?.status,
    item?.printer_name || item?.printerName,
    item?.completed_at || item?.completedAt || item?.updated_at || item?.updatedAt,
  ].filter(Boolean).join(' - ')
}

function stockworksMessage(data: any) {
  const stockworks = data?.stockworks
  if (!stockworks) return null
  if (stockworks.ok) return `StockWorks updated${Number.isFinite(Number(stockworks.movements)) ? ` with ${stockworks.movements} movement${Number(stockworks.movements) === 1 ? '' : 's'}` : ''}.`
  return typeof stockworks.warning === 'string' ? stockworks.warning : null
}

export default function PrintLabLinkPanel({ orderId, current }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<PanelMode>('search')
  const [searchKind, setSearchKind] = useState<SearchKind>('jobs')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [pasteMode, setPasteMode] = useState<PasteMode>('auto')
  const [pastedId, setPastedId] = useState('')
  const [manualId, setManualId] = useState('')
  const [manualStatus, setManualStatus] = useState('completed')
  const [manualPrinter, setManualPrinter] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const path = searchKind === 'jobs' ? '/api/admin/printlab/jobs' : '/api/admin/printlab/successful-gcodes'
      const res = await fetch(`${path}?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'PrintLab search failed')
      setResults(Array.isArray(data?.items) ? data.items : [])
    } catch (err: any) {
      setError(err?.message || 'PrintLab search failed')
    } finally {
      setBusy(false)
    }
  }

  const attach = async (body: Record<string, unknown>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/printlab-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'PrintLab link failed')
      pushSessionNotification({
        type: 'success',
        title: 'PrintLab job connected',
        message: stockworksMessage(data) || 'The order now references the selected PrintLab record.',
      })
      router.refresh()
    } catch (err: any) {
      const message = err?.message || 'PrintLab link failed'
      setError(message)
      pushSessionNotification({ type: 'error', title: 'PrintLab link failed', message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-white/10 p-4 bg-black/20 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Completed PrintLab job</p>
          <p className="text-xs text-slate-400 mt-1">
            {current?.printLabJobId
              ? `${current.status || 'linked'} - ${current.printerName || 'PrintLab'} - ${current.printLabJobId}`
              : 'No completed PrintLab job connected.'}
          </p>
          {current?.error ? <p className="text-xs text-rose-200 mt-1">{current.error}</p> : null}
        </div>
        <select
          className="input w-36"
          value={mode}
          onChange={(event) => setMode(event.target.value as PanelMode)}
        >
          <option value="search">Search</option>
          <option value="paste">Paste ID</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {mode === 'search' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <select
              className="input w-44"
              value={searchKind}
              onChange={(event) => {
                setSearchKind(event.target.value as SearchKind)
                setResults([])
              }}
            >
              <option value="jobs">Submitted jobs</option>
              <option value="successful-gcodes">Successful G-code</option>
            </select>
            <input
              className="input flex-1 min-w-[180px]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ID, model, printer"
            />
            <button
              type="button"
              className="text-sm px-3 py-2 rounded-md border border-white/10 hover:border-white/30 disabled:opacity-50"
              onClick={search}
              disabled={busy}
            >
              {busy ? 'Searching...' : 'Search'}
            </button>
          </div>
          {results.length > 0 ? (
            <div className="space-y-2">
              {results.map((item) => (
                <button
                  key={`${searchKind}-${item.id}`}
                  type="button"
                  className="w-full text-left rounded-lg border border-white/10 p-3 hover:border-brand-400 disabled:opacity-50"
                  disabled={busy || !item.id}
                  onClick={() => attach({ mode: searchKind === 'jobs' ? 'submitted_job' : 'successful_gcode', id: item.id, note })}
                >
                  <span className="block text-sm text-slate-100">{recordTitle(item)}</span>
                  <span className="block text-xs text-slate-400 break-words">{item.id} - {recordMeta(item)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === 'paste' ? (
        <div className="flex flex-wrap gap-2">
          <select
            className="input w-44"
            value={pasteMode}
            onChange={(event) => setPasteMode(event.target.value as PasteMode)}
          >
            <option value="auto">Auto detect</option>
            <option value="submitted_job">Submitted job</option>
            <option value="successful_gcode">Successful G-code</option>
          </select>
          <input
            className="input flex-1 min-w-[180px]"
            value={pastedId}
            onChange={(event) => setPastedId(event.target.value)}
            placeholder="PrintLab job or G-code ID"
          />
          <button
            type="button"
            className="text-sm px-3 py-2 rounded-md border border-white/10 hover:border-white/30 disabled:opacity-50"
            onClick={() => attach({ mode: pasteMode, id: pastedId, note })}
            disabled={busy || !pastedId.trim()}
          >
            Connect
          </button>
        </div>
      ) : null}

      {mode === 'manual' ? (
        <div className="grid md:grid-cols-4 gap-2">
          <input className="input" value={manualId} onChange={(event) => setManualId(event.target.value)} placeholder="PrintLab ID" />
          <input className="input" value={manualStatus} onChange={(event) => setManualStatus(event.target.value)} placeholder="Status" />
          <input className="input" value={manualPrinter} onChange={(event) => setManualPrinter(event.target.value)} placeholder="Printer name" />
          <button
            type="button"
            className="text-sm px-3 py-2 rounded-md border border-white/10 hover:border-white/30 disabled:opacity-50"
            onClick={() => attach({ mode: 'manual', manual: { printLabJobId: manualId, status: manualStatus, printerName: manualPrinter, note } })}
            disabled={busy || !manualId.trim()}
          >
            Save
          </button>
        </div>
      ) : null}

      <input
        className="input w-full"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional internal note"
      />
      {error ? <p className="text-xs text-rose-200">{error}</p> : null}
    </div>
  )
}
