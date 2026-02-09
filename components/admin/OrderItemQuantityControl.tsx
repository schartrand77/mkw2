'use client'

import { useState } from 'react'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type Props = {
  orderId: string
  itemId: string
  quantity: number
}

export default function OrderItemQuantityControl({ orderId, itemId, quantity }: Props) {
  const [value, setValue] = useState<number>(quantity)
  const [pending, setPending] = useState(false)

  const dirty = value !== quantity

  const save = async () => {
    if (!dirty || pending) return
    setPending(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to update quantity.')
      pushSessionNotification({
        type: 'success',
        title: 'Order updated',
        message: `Quantity set to ${value}.`,
      })
      window.location.reload()
    } catch (err: any) {
      pushSessionNotification({
        type: 'error',
        title: 'Update failed',
        message: err?.message || 'Unable to update quantity.',
      })
      setValue(quantity)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <label className="text-xs text-slate-400">Qty</label>
      <input
        type="number"
        min={1}
        max={999}
        step={1}
        value={value}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10)
          setValue(Number.isFinite(parsed) && parsed > 0 ? parsed : 1)
        }}
        className="w-20 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
        disabled={pending}
      />
      <button
        type="button"
        onClick={save}
        disabled={!dirty || pending}
        className="px-2.5 py-1 rounded-md border border-white/20 text-xs hover:border-white/40 disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Save qty'}
      </button>
    </div>
  )
}

