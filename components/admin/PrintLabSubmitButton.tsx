"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type Props = {
  orderId: string
  disabled?: boolean
}

export default function PrintLabSubmitButton({ orderId, disabled }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy || disabled) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/printlab-submit`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'PrintLab submission failed')
      const count = Array.isArray(data?.submitted) ? data.submitted.length : 0
      pushSessionNotification({
        type: 'success',
        title: 'Submitted to PrintLab',
        message: `${count} job${count === 1 ? '' : 's'} submitted to the PrintLab routing queue.`,
      })
      router.refresh()
    } catch (err: any) {
      pushSessionNotification({
        type: 'error',
        title: 'PrintLab submit failed',
        message: err?.message || 'Unable to submit this order to PrintLab.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="text-sm px-3 py-1.5 rounded-md border border-brand-500/60 bg-brand-500/15 text-white hover:border-brand-400 disabled:opacity-50"
      onClick={submit}
      disabled={busy || disabled}
    >
      {busy ? 'Submitting to PrintLab...' : 'Submit to PrintLab'}
    </button>
  )
}
