'use client'

import { useEffect, useMemo, useState } from 'react'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type Printer = {
  id: string
  name: string
  provider?: string | null
  externalId?: string | null
  status?: string | null
  active?: boolean | null
}

type TrayMapEntry = { color: string; tray: number }

type Props = {
  orderId: string
  initialPrinterId?: string | null
  colors?: string[]
  initialTrayMap?: TrayMapEntry[] | null
}

function normalizeTrayMap(entries?: TrayMapEntry[] | null) {
  const map: Record<string, number> = {}
  if (!Array.isArray(entries)) return map
  for (const entry of entries) {
    if (!entry || typeof entry.color !== 'string' || typeof entry.tray !== 'number') continue
    map[entry.color] = entry.tray
  }
  return map
}

export default function PrinterAssignmentPanel({ orderId, initialPrinterId, colors = [], initialTrayMap }: Props) {
  const [printers, setPrinters] = useState<Printer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(initialPrinterId || '')
  const [trayMap, setTrayMap] = useState<Record<string, number>>(() => normalizeTrayMap(initialTrayMap))

  const sortedColors = useMemo(() => Array.from(new Set(colors.map((c) => c.trim()).filter(Boolean))).sort(), [colors])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/printers', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Failed to load printers')
        if (mounted) setPrinters(Array.isArray(data?.printers) ? data.printers : [])
      } catch (err: any) {
        pushSessionNotification({ type: 'error', title: 'Printer load failed', message: err?.message || 'Unable to load printers.' })
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (initialPrinterId !== undefined) setSelectedPrinterId(initialPrinterId || '')
  }, [initialPrinterId])

  const updateTray = (color: string, tray: number | null) => {
    setTrayMap((prev) => {
      const next = { ...prev }
      if (!tray) {
        delete next[color]
      } else {
        next[color] = tray
      }
      return next
    })
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const amsTrayMap = sortedColors.map((color) => ({
        color,
        tray: trayMap[color],
      })).filter((entry) => Number.isFinite(entry.tray))
      const res = await fetch(`/api/admin/orders/${orderId}/assign-printer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerId: selectedPrinterId ? selectedPrinterId : null,
          amsTrayMap: amsTrayMap.length ? amsTrayMap : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to save assignment')
      pushSessionNotification({
        type: 'success',
        title: 'Printer assignment updated',
        message: selectedPrinterId ? 'Printer assigned.' : 'Printer unassigned.',
      })
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Assignment failed', message: err?.message || 'Unable to update printer assignment.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Printer assignment</p>
        <select
          className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
          value={selectedPrinterId}
          onChange={(e) => setSelectedPrinterId(e.target.value)}
          disabled={loading || saving}
        >
          <option value="">Unassigned</option>
          {printers.map((printer) => (
            <option key={printer.id} value={printer.id}>
              {printer.name}{printer.active === false ? ' (inactive)' : ''}{printer.provider ? ` - ${printer.provider}` : ''}
            </option>
          ))}
        </select>
      </div>

      {sortedColors.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">AMS tray map</p>
          <div className="grid gap-2">
            {sortedColors.map((color) => (
              <label key={color} className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                <span>{color}</span>
                <select
                  className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                  value={trayMap[color] ?? ''}
                  onChange={(e) => updateTray(color, e.target.value ? Number(e.target.value) : null)}
                  disabled={saving}
                >
                  <option value="">Unmapped</option>
                  {[1, 2, 3, 4].map((tray) => (
                    <option key={tray} value={tray}>
                      Tray {tray}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-sm disabled:opacity-60"
        onClick={save}
        disabled={saving || loading}
      >
        {saving ? 'Saving...' : 'Save printer assignment'}
      </button>
    </div>
  )
}
