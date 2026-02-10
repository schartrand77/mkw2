'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  orderId: string
  orderNumber?: number | null
}

function formatOrderNumber(orderNumber?: number | null) {
  if (!orderNumber || orderNumber <= 0) return 'Draft order'
  return `MW-${orderNumber.toString().padStart(5, '0')}`
}

export default function DeleteOrderButton({ orderId, orderNumber }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDelete = async () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Delete ${formatOrderNumber(orderNumber)}? This cannot be undone.`)
      if (!confirmed) return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to delete order')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to delete order')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="text-xs px-2 py-1 rounded-md border border-rose-400/50 text-rose-200 hover:border-rose-300 disabled:opacity-50"
      >
        {busy ? 'Deleting...' : 'Delete order'}
      </button>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  )
}

