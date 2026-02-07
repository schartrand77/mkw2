'use client'

import { useMemo, useState } from 'react'
import { ORDER_STATUS_FLOW, normalizeOrderStatus } from '@/lib/order-status'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type FlowStatus = (typeof ORDER_STATUS_FLOW)[number]['key']

type Props = {
  orderId: string
  status: string
}

export default function OrderStatusControl({ orderId, status }: Props) {
  const normalized = useMemo(() => normalizeOrderStatus(status), [status])
  const [value, setValue] = useState<FlowStatus>(normalized)
  const [pending, setPending] = useState(false)

  const dirty = value !== normalized

  const save = async () => {
    if (!dirty || pending) return
    setPending(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to update status.')
      pushSessionNotification({
        type: 'success',
        title: 'Status updated',
        message: `Order set to ${ORDER_STATUS_FLOW.find((s) => s.key === value)?.label || value}.`,
      })
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Update failed', message: err?.message || 'Unable to update status.' })
      setValue(normalized)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
        value={value}
        onChange={(e) => setValue(e.target.value as FlowStatus)}
        disabled={pending}
      >
        {ORDER_STATUS_FLOW.map((entry) => (
          <option key={entry.key} value={entry.key}>
            {entry.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={!dirty || pending}
        className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-sm disabled:opacity-60"
      >
        {pending ? 'Saving...' : 'Update'}
      </button>
    </div>
  )
}
