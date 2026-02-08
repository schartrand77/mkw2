"use client"

import { useState } from 'react'

type PrinterEntry = {
  id: string
  name: string
  lastMaintenanceAt?: string | null
  maintenanceIntervalHours?: number | null
  maintenanceNotes?: string | null
}

export default function FleetMaintenancePanel({ printers }: { printers: PrinterEntry[] }) {
  const [rows, setRows] = useState(printers)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateRow = (id: string, patch: Partial<PrinterEntry>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const saveRow = async (row: PrinterEntry) => {
    setSavingId(row.id)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/printers/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastMaintenanceAt: row.lastMaintenanceAt || null,
          maintenanceIntervalHours: row.maintenanceIntervalHours ?? null,
          maintenanceNotes: row.maintenanceNotes ?? null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Save failed')
      setMessage(`Saved ${row.name}`)
    } catch (err: any) {
      setError(err?.message || 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Maintenance schedules</h2>
        {message && <span className="text-xs text-emerald-300">{message}</span>}
      </div>
      {error && <div className="text-xs text-rose-300">{error}</div>}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
            <div className="font-semibold">{row.name}</div>
            <div className="grid sm:grid-cols-3 gap-2 text-xs">
              <label className="space-y-1">
                <span className="text-slate-400">Last maintenance</span>
                <input
                  className="input"
                  type="date"
                  value={row.lastMaintenanceAt ? row.lastMaintenanceAt.slice(0, 10) : ''}
                  onChange={(e) => updateRow(row.id, { lastMaintenanceAt: e.target.value || null })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Interval (hours)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1}
                  value={row.maintenanceIntervalHours ?? ''}
                  onChange={(e) => updateRow(row.id, { maintenanceIntervalHours: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Notes</span>
                <input
                  className="input"
                  value={row.maintenanceNotes ?? ''}
                  onChange={(e) => updateRow(row.id, { maintenanceNotes: e.target.value })}
                  placeholder="Nozzle swap, belts, etc."
                />
              </label>
            </div>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="rounded-md border border-white/10 px-3 py-1 hover:border-white/20"
                onClick={() => saveRow(row)}
                disabled={savingId === row.id}
              >
                {savingId === row.id ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
