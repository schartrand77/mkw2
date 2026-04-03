'use client'

import { useEffect, useMemo, useState } from 'react'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type ChecklistItem = {
  id: string
  label: string
  qty: number
  status: 'pending' | 'packed' | 'missing'
}

type Props = {
  orderId: string
  initialItems?: ChecklistItem[]
}

function normalizeItems(items?: ChecklistItem[] | null) {
  if (!Array.isArray(items)) return []
  return items.filter((item) => item && typeof item.id === 'string')
}

export default function PackingChecklist({ orderId, initialItems }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(() => normalizeItems(initialItems))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const summary = useMemo(() => {
    const total = items.length
    const packed = items.filter((item) => item.status === 'packed').length
    const missing = items.filter((item) => item.status === 'missing').length
    return { total, packed, missing }
  }, [items])

  useEffect(() => {
    if (initialItems && initialItems.length > 0) return
    const fetchChecklist = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/packing-checklist`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (res.ok && Array.isArray(data?.checklist)) {
          setItems(normalizeItems(data.checklist))
        }
      } finally {
        setLoading(false)
      }
    }
    fetchChecklist()
  }, [initialItems, orderId])

  const generate = async () => {
    if (loading || saving) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/packing-checklist`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to generate checklist')
      setItems(normalizeItems(data.checklist))
      pushSessionNotification({ type: 'success', title: 'Checklist generated', message: 'Packing checklist created.' })
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Checklist failed', message: err?.message || 'Unable to generate checklist.' })
    } finally {
      setLoading(false)
    }
  }

  const updateItem = (id: string, status: ChecklistItem['status']) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/packing-checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to save checklist')
      setItems(normalizeItems(data.checklist))
      pushSessionNotification({ type: 'success', title: 'Checklist saved', message: 'Packing checklist updated.' })
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Save failed', message: err?.message || 'Unable to save checklist.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Packing checklist</p>
        <div className="text-xs text-slate-400">
          {summary.packed}/{summary.total} packed{summary.missing ? ` · ${summary.missing} missing` : ''}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-black/30 p-3 text-sm text-slate-400">
          No checklist yet.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-white">{item.label}</p>
                  <p className="text-xs text-slate-400">Qty: {item.qty}</p>
                </div>
                <select
                  className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                  value={item.status}
                  onChange={(e) => updateItem(item.id, e.target.value as ChecklistItem['status'])}
                  disabled={saving}
                >
                  <option value="pending">Pending</option>
                  <option value="packed">Packed</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-sm disabled:opacity-60"
          onClick={generate}
          disabled={loading || saving}
        >
          {loading ? 'Generating...' : items.length ? 'Regenerate checklist' : 'Generate checklist'}
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-sm disabled:opacity-60"
          onClick={save}
          disabled={saving || items.length === 0}
        >
          {saving ? 'Saving...' : 'Save checklist'}
        </button>
      </div>
    </div>
  )
}
