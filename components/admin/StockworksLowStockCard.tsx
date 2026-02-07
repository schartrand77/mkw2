'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type StockworksMaterial = {
  id: number
  name: string
  filament_type?: string | null
  brand?: string | null
  color?: string | null
}

type StockworksInventoryItem = {
  id: number
  material_id: number
  location: string
  quantity_grams: number
  reorder_level: number
  material?: StockworksMaterial | null
}

export default function StockworksLowStockCard() {
  const [items, setItems] = useState<StockworksInventoryItem[]>([])
  const [loading, setLoading] = useState(false)

  const lowStock = useMemo(() => {
    return items.filter((item) => Number(item.quantity_grams) <= Number(item.reorder_level))
      .sort((a, b) => (a.quantity_grams - a.reorder_level) - (b.quantity_grams - b.reorder_level))
  }, [items])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stockworks/inventory', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.enabled === false) throw new Error(data?.error || 'StockWorks not available')
      setItems(Array.isArray(data.inventory) ? data.inventory : [])
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Low stock check failed', message: err?.message || 'Unable to fetch inventory.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Low-stock alerts</h3>
          <p className="text-xs text-slate-400">Items at or below reorder level.</p>
        </div>
        <button
          type="button"
          className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-xs"
          onClick={load}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {lowStock.length === 0 ? (
        <p className="text-sm text-slate-500">No low-stock alerts right now.</p>
      ) : (
        <div className="space-y-2">
          {lowStock.slice(0, 8).map((item) => (
            <div key={item.id} className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-amber-100">{item.material?.name || `Item ${item.id}`}</div>
                  <div className="text-xs text-amber-200/80">{item.material?.filament_type || 'Unknown type'} · {item.location}</div>
                </div>
                <div className="text-right text-xs text-amber-200">
                  <div>{item.quantity_grams.toFixed(1)} g</div>
                  <div>Reorder at {item.reorder_level.toFixed(1)} g</div>
                </div>
              </div>
            </div>
          ))}
          {lowStock.length > 8 ? (
            <p className="text-xs text-slate-400">+{lowStock.length - 8} more items</p>
          ) : null}
        </div>
      )}

      <Link href="/admin/inventory" className="inline-flex text-xs text-brand-300 underline">
        Open inventory adjustments
      </Link>
    </div>
  )
}