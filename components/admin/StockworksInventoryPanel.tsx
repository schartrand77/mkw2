'use client'

import { useEffect, useMemo, useState } from 'react'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type StockworksMaterial = {
  id: number
  name: string
  filament_type?: string | null
  brand?: string | null
  color?: string | null
  color_hex?: string | null
  spool_weight_grams?: number | null
}

type StockworksInventoryItem = {
  id: number
  material_id: number
  location: string
  quantity_grams: number
  reorder_level: number
  spool_serial?: string | null
  unit_cost_override?: number | null
  material?: StockworksMaterial | null
}

type StockMovement = {
  id: number
  inventory_item_id: number
  movement_type: string
  change_grams: number
  reference?: string | null
  note?: string | null
  created_at: string
}

export default function StockworksInventoryPanel() {
  const [inventory, setInventory] = useState<StockworksInventoryItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMoves, setLoadingMoves] = useState(false)
  const [adjustment, setAdjustment] = useState('')
  const [movementType, setMovementType] = useState<'incoming' | 'outgoing' | 'adjustment'>('adjustment')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')

  const selected = useMemo(() => inventory.find((item) => item.id === selectedId) || null, [inventory, selectedId])

  const loadInventory = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stockworks/inventory', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.enabled === false) throw new Error(data?.error || 'StockWorks not available')
      setInventory(Array.isArray(data.inventory) ? data.inventory : [])
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Inventory load failed', message: err?.message || 'Unable to fetch StockWorks inventory.' })
    } finally {
      setLoading(false)
    }
  }

  const loadMovements = async (itemId: number) => {
    setLoadingMoves(true)
    try {
      const res = await fetch(`/api/stockworks/inventory/${itemId}/movements`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.enabled === false) throw new Error(data?.error || 'Unable to load movements')
      setMovements(Array.isArray(data.movements) ? data.movements : [])
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Movement log failed', message: err?.message || 'Unable to fetch movements.' })
    } finally {
      setLoadingMoves(false)
    }
  }

  useEffect(() => {
    loadInventory().catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedId) loadMovements(selectedId).catch(() => {})
  }, [selectedId])

  const submitAdjustment = async () => {
    if (!selectedId) return
    const change = Number(adjustment)
    if (!Number.isFinite(change) || change === 0) {
      pushSessionNotification({ type: 'error', title: 'Invalid adjustment', message: 'Enter a non-zero gram change.' })
      return
    }
    const payload = {
      inventory_item_id: selectedId,
      change_grams: change,
      movement_type: movementType,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    }
    try {
      const res = await fetch('/api/stockworks/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data?.error || 'Adjustment failed')
      pushSessionNotification({ type: 'success', title: 'Adjustment saved', message: 'Stock movement recorded.' })
      setAdjustment('')
      setReference('')
      setNote('')
      await loadInventory()
      await loadMovements(selectedId)
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Adjustment failed', message: err?.message || 'Unable to log movement.' })
    }
  }

  return (
    <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
      <div className="glass rounded-xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Filament inventory</h2>
            <p className="text-xs text-slate-400">Adjust StockWorks counts and log changes.</p>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-xs"
            onClick={() => loadInventory()}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="max-h-[460px] overflow-y-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-950/90 text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Material</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Qty (g)</th>
                <th className="px-3 py-2">Reorder</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => {
                const material = item.material
                const isSelected = item.id === selectedId
                return (
                  <tr
                    key={item.id}
                    className={`border-t border-white/5 cursor-pointer ${isSelected ? 'bg-brand-500/10' : 'hover:bg-white/5'}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{material?.name || `Item ${item.id}`}</div>
                      <div className="text-xs text-slate-500">{material?.color || material?.brand || ''}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">{material?.filament_type || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-200">{item.quantity_grams.toFixed(1)}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{item.reorder_level.toFixed(0)}</td>
                  </tr>
                )
              })}
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">No inventory loaded.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="glass rounded-xl border border-white/10 p-4 space-y-3">
          <h2 className="text-lg font-semibold">Adjustment</h2>
          {selected ? (
            <div className="text-sm text-slate-300">
              <div className="font-medium">{selected.material?.name || `Item ${selected.id}`}</div>
              <div className="text-xs text-slate-500">Location: {selected.location}</div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select an inventory item to log a movement.</p>
          )}
          <div className="grid gap-2">
            <label className="text-xs text-slate-400">Movement type</label>
            <select
              className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as any)}
              disabled={!selected}
            >
              <option value="adjustment">Adjustment</option>
              <option value="incoming">Incoming</option>
              <option value="outgoing">Outgoing</option>
            </select>
            <label className="text-xs text-slate-400">Change (grams)</label>
            <input
              className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              type="number"
              step="0.1"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              disabled={!selected}
            />
            <label className="text-xs text-slate-400">Reference</label>
            <input
              className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Order #, PO, or note"
              disabled={!selected}
            />
            <label className="text-xs text-slate-400">Note</label>
            <input
              className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional detail"
              disabled={!selected}
            />
            <button
              type="button"
              className="mt-2 px-3 py-2 rounded-md border border-white/10 hover:border-white/30 text-sm disabled:opacity-60"
              onClick={submitAdjustment}
              disabled={!selected}
            >
              Log movement
            </button>
          </div>
        </div>

        <div className="glass rounded-xl border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Audit log</h2>
            {selectedId ? (
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-md border border-white/10 hover:border-white/30"
                onClick={() => selectedId && loadMovements(selectedId)}
                disabled={loadingMoves}
              >
                {loadingMoves ? 'Loading...' : 'Refresh'}
              </button>
            ) : null}
          </div>
          {selectedId ? (
            <div className="max-h-[320px] overflow-y-auto text-sm">
              {movements.length === 0 ? (
                <p className="text-slate-500">No movements logged yet.</p>
              ) : (
                <ul className="space-y-2">
                  {movements.map((move) => (
                    <li key={move.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{new Date(move.created_at).toLocaleString()}</span>
                        <span className="uppercase tracking-[0.2em]">{move.movement_type}</span>
                      </div>
                      <div className="text-sm text-slate-200">{move.change_grams.toFixed(1)} g</div>
                      {move.reference ? <div className="text-xs text-slate-400">Ref: {move.reference}</div> : null}
                      {move.note ? <div className="text-xs text-slate-500">{move.note}</div> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select an inventory item to view its audit log.</p>
          )}
        </div>
      </div>
    </div>
  )
}