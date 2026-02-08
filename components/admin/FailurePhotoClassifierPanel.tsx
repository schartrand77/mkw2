"use client"

import { useMemo, useState } from 'react'
import { buildImageSrc } from '@/lib/public-path'

type FailurePhotoRecord = {
  id: string
  filePath: string
  label: string
  confidence: number | null
  createdAt: string
  note?: string | null
  orderId?: string | null
  printerId?: string | null
  modelId?: string | null
  orderNumber?: number | null
  printerName?: string | null
  modelTitle?: string | null
  signals?: any
  uploadedBy?: { id: string; name?: string | null; email?: string | null } | null
}

type Props = {
  initial: FailurePhotoRecord[]
}

export default function FailurePhotoClassifierPanel({ initial }: Props) {
  const [items, setItems] = useState<FailurePhotoRecord[]>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const latest = items[0]
  const latestSignals = useMemo(() => latest?.signals || null, [latest])

  const onSubmit = async (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault()
    setError(null)
    setStatus(null)
    const form = evt.currentTarget
    const fd = new FormData(form)
    const file = fd.get('photo')
    if (!(file instanceof File) || !file.size) {
      setError('Choose a photo to classify.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/failure-photos', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Upload failed')
      const record = json.photo as FailurePhotoRecord
      setItems((prev) => [record, ...prev])
      form.reset()
      setStatus(`Classified as ${record.label}.`)
    } catch (err: any) {
      setError(err?.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/failure-photos?limit=25')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to refresh')
      setItems(json.photos || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to refresh')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-black/30 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold">Failure photo classifier</h2>
            <p className="text-xs text-slate-400">Upload a photo to detect common failure modes.</p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:text-white"
            disabled={busy}
          >
            Refresh list
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-xs text-slate-400">Photo</label>
            <input
              name="photo"
              type="file"
              accept="image/*"
              className="block w-full text-sm text-slate-200"
              disabled={busy}
              required
            />
            <label className="text-xs text-slate-400">Notes (optional)</label>
            <textarea
              name="note"
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100"
              placeholder="Observed symptoms, print settings, etc."
              disabled={busy}
            />
          </div>
          <div className="space-y-3">
            <label className="text-xs text-slate-400">Link to order (optional)</label>
            <input
              name="orderId"
              type="text"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100"
              placeholder="PrintOrder ID"
              disabled={busy}
            />
            <label className="text-xs text-slate-400">Link to printer (optional)</label>
            <input
              name="printerId"
              type="text"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100"
              placeholder="Printer ID"
              disabled={busy}
            />
            <label className="text-xs text-slate-400">Link to model (optional)</label>
            <input
              name="modelId"
              type="text"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100"
              placeholder="Model ID"
              disabled={busy}
            />
            <label className="text-xs text-slate-400">Override label (optional)</label>
            <input
              name="overrideLabel"
              type="text"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100"
              placeholder="e.g. layer_shift"
              disabled={busy}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-brand-400 px-4 py-2 text-sm font-semibold text-black hover:bg-brand-300 disabled:opacity-60"
          >
            {busy ? 'Processing…' : 'Classify photo'}
          </button>
          {status ? <span className="text-xs text-emerald-300">{status}</span> : null}
          {error ? <span className="text-xs text-rose-300">{error}</span> : null}
        </div>
      </form>

      {latest && (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5 space-y-3">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Latest classification</div>
          <div className="grid md:grid-cols-[220px,1fr] gap-4">
            <img
              src={buildImageSrc(latest.filePath, latest.createdAt) || ''}
              alt={latest.label}
              className="w-full rounded-xl border border-white/10 object-cover"
              loading="lazy"
            />
            <div className="space-y-2 text-sm">
              <div className="text-lg font-semibold">{latest.label}</div>
              <div className="text-xs text-slate-400">Confidence: {latest.confidence ?? 'n/a'}</div>
              {latest.note ? <div className="text-xs text-slate-300">Note: {latest.note}</div> : null}
              {latestSignals ? (
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div>Edge density: {latestSignals.edgeDensity}</div>
                  <div>Brightness: {latestSignals.mean}</div>
                  <div>Border edges: {latestSignals.borderEdgeRatio}</div>
                  <div>Edge bias: {latestSignals.edgeBias}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Recent failures</div>
          <div className="text-xs text-slate-500">{items.length} photos</div>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No failure photos captured yet.</p>
        ) : (
          <div className="grid lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                <img
                  src={buildImageSrc(item.filePath, item.createdAt) || ''}
                  alt={item.label}
                  className="h-40 w-full rounded-lg border border-white/10 object-cover"
                  loading="lazy"
                />
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="text-xs text-slate-400">Confidence: {item.confidence ?? 'n/a'}</div>
                <div className="text-xs text-slate-500">
                  {item.orderNumber ? `Order MW-${String(item.orderNumber).padStart(5, '0')}` : 'Unlinked order'}
                  {item.printerName ? ` · ${item.printerName}` : ''}
                </div>
                {item.modelTitle ? <div className="text-xs text-slate-500">Model: {item.modelTitle}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
