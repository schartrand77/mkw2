'use client'

import { useState } from 'react'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type Props = {
  orderId: string
  itemId: string
  quantity: number
}

export default function OrderItemQuantityControl({ orderId, itemId, quantity }: Props) {
  const [value, setValue] = useState<string>(String(quantity))
  const [pending, setPending] = useState(false)

  const parsedValue = Number.parseInt(value, 10)
  const normalizedValue = Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null
  const dirty = normalizedValue !== null && normalizedValue !== quantity

  const save = async () => {
    if (!dirty || pending || normalizedValue == null) return
    setPending(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: normalizedValue }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to update quantity.')
      pushSessionNotification({
        type: 'success',
        title: 'Order updated',
        message: `Quantity set to ${normalizedValue}.`,
      })
      window.location.reload()
    } catch (err: any) {
      pushSessionNotification({
        type: 'error',
        title: 'Update failed',
        message: err?.message || 'Unable to update quantity.',
      })
      setValue(String(quantity))
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
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value.trim() === '') {
            setValue(String(quantity))
            return
          }
          const parsed = Number.parseInt(value, 10)
          if (!Number.isFinite(parsed) || parsed < 1) {
            setValue('1')
            return
          }
          if (parsed > 999) {
            setValue('999')
            return
          }
          setValue(String(parsed))
        }}
        className="w-20 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
        disabled={pending}
      />
      <button
        type="button"
        onClick={save}
        disabled={!dirty || pending || normalizedValue == null}
        className="px-2.5 py-1 rounded-md border border-white/20 text-xs hover:border-white/40 disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Save qty'}
      </button>
    </div>
  )
}
