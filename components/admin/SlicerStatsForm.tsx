'use client'

import { useState } from 'react'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type MaterialEntry = {
  material: string
  grams: string
  colors: string
}

type Props = {
  orderId: string
  initial?: { materials?: Array<{ material: string; grams: number; colors?: string[] }>; printHours?: number | null } | null
}

function toEntry(entry?: { material: string; grams: number; colors?: string[] }): MaterialEntry {
  return {
    material: entry?.material || '',
    grams: entry?.grams != null ? String(entry.grams) : '',
    colors: entry?.colors?.join(', ') || '',
  }
}

export default function SlicerStatsForm({ orderId, initial }: Props) {
  const [printHours, setPrintHours] = useState<string>(
    initial?.printHours != null && Number.isFinite(Number(initial.printHours)) ? String(initial.printHours) : '',
  )
  const [entries, setEntries] = useState<MaterialEntry[]>(
    (initial?.materials || []).map(toEntry).filter((entry) => entry.material || entry.grams),
  )
  const [saving, setSaving] = useState(false)

  const addRow = () => {
    setEntries((prev) => [...prev, { material: '', grams: '', colors: '' }])
  }

  const updateRow = (index: number, patch: Partial<MaterialEntry>) => {
    setEntries((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, ...patch } : entry)))
  }

  const removeRow = (index: number) => {
    setEntries((prev) => prev.filter((_, idx) => idx !== index))
  }

  const save = async () => {
    if (saving) return
    const hoursValue = printHours.trim() === '' ? null : Number(printHours)
    const hasValidHours = hoursValue == null || (Number.isFinite(hoursValue) && hoursValue > 0)
    const payload = entries
      .map((entry) => {
        const grams = Number(entry.grams)
        if (!entry.material.trim() || !Number.isFinite(grams) || grams <= 0) return null
        const colors = entry.colors
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
        return { material: entry.material.trim(), grams, colors }
      })
      .filter(Boolean) as Array<{ material: string; grams: number; colors?: string[] }>

    if (payload.length === 0 && hoursValue == null) {
      pushSessionNotification({ type: 'error', title: 'Missing data', message: 'Add at least one material entry or print hours.' })
      return
    }

    if (payload.length === 0 && !hasValidHours) {
      pushSessionNotification({ type: 'error', title: 'Missing data', message: 'Add at least one material usage entry.' })
      return
    }

    if (!hasValidHours) {
      pushSessionNotification({ type: 'error', title: 'Invalid hours', message: 'Enter a valid print hour total.' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/slicer-stats`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materials: payload, printHours: hoursValue }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to save slicer stats')
      pushSessionNotification({ type: 'success', title: 'Slicer stats saved', message: 'Auto-consumption will use these values.' })
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Save failed', message: err?.message || 'Unable to save slicer stats.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Slicer material stats</p>
      <div className="grid gap-2 md:grid-cols-2 text-sm">
        <label className="space-y-1">
          <span className="text-xs text-slate-400">Actual print hours</span>
          <input
            className="input"
            value={printHours}
            onChange={(e) => setPrintHours(e.target.value)}
            placeholder="e.g. 6.4"
          />
        </label>
        <div className="text-xs text-slate-500 self-end">
          Used to calibrate time estimates across the fleet.
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">No slicer stats yet. Add usage to drive auto-consumption.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div key={`${entry.material}-${index}`} className="rounded-md border border-white/10 bg-black/20 p-3 space-y-2">
              <div className="grid gap-2 md:grid-cols-3 text-sm">
                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Material</span>
                  <input
                    className="input"
                    value={entry.material}
                    onChange={(e) => updateRow(index, { material: e.target.value })}
                    placeholder="PLA, PETG, etc."
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Grams used</span>
                  <input
                    className="input"
                    value={entry.grams}
                    onChange={(e) => updateRow(index, { grams: e.target.value })}
                    placeholder="125"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-400">Colors (comma)</span>
                  <input
                    className="input"
                    value={entry.colors}
                    onChange={(e) => updateRow(index, { colors: e.target.value })}
                    placeholder="Red, Black"
                  />
                </label>
              </div>
              <button
                type="button"
                className="text-xs text-rose-300 hover:text-rose-200"
                onClick={() => removeRow(index)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-sm"
          onClick={addRow}
        >
          Add material usage
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-sm disabled:opacity-60"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save slicer stats'}
        </button>
      </div>
    </div>
  )
}
