"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

export default function OrderMessageComposer({ orderId }: { orderId: string }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const router = useRouter()

  const submit = async () => {
    if (!message.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/customer/orders/${orderId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: message.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Unable to send message.')
      setMessage('')
      pushSessionNotification({ type: 'success', title: 'Message sent', message: 'We will reply soon.' })
      router.refresh()
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Message failed', message: err?.message || 'Unable to send message.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        className="input h-24"
        placeholder="Send a message to the shop"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        disabled={sending}
      />
      <button type="button" className="btn w-full sm:w-auto justify-center disabled:opacity-50" onClick={submit} disabled={sending || !message.trim()}>
        {sending ? 'Sending...' : 'Send message'}
      </button>
    </div>
  )
}
