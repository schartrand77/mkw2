"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

export default function RequestReprintButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const request = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/customer/orders/${orderId}/reprint`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || 'Unable to request reprint.')
      }
      pushSessionNotification({ type: 'success', title: 'Reprint requested', message: 'We will queue this job shortly.' })
      router.refresh()
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Request failed', message: err?.message || 'Unable to request reprint.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={request}
      disabled={loading}
      className="btn w-full sm:w-auto justify-center disabled:opacity-50"
    >
      {loading ? 'Requesting...' : 'Request reprint'}
    </button>
  )
}
