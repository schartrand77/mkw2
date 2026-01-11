"use client"

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type ApprovalRequest = {
  id: string
  message: string
  status: string
  createdAt: string | Date
}

export default function ApprovalRequests({ orderId, requests }: { orderId: string; requests: ApprovalRequest[] }) {
  const router = useRouter()
  const pending = useMemo(() => requests.filter((request) => request.status === 'pending'), [requests])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  const setNote = (id: string, value: string) => {
    setNotes((prev) => ({ ...prev, [id]: value }))
  }

  const respond = async (requestId: string, status: 'approved' | 'changes_requested') => {
    if (submitting) return
    setSubmitting(requestId)
    try {
      const res = await fetch(`/api/customer/orders/${orderId}/approval-requests/${requestId}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: notes[requestId] }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Unable to submit response.')
      pushSessionNotification({
        type: 'success',
        title: status === 'approved' ? 'Approved' : 'Changes requested',
        message: status === 'approved' ? 'Thanks! We will proceed.' : 'We will review your feedback.',
      })
      setNotes((prev) => ({ ...prev, [requestId]: '' }))
      router.refresh()
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Update failed', message: err?.message || 'Unable to respond.' })
    } finally {
      setSubmitting(null)
    }
  }

  if (pending.length === 0) {
    return <p className="text-sm text-slate-400">No pending approvals right now.</p>
  }

  return (
    <div className="space-y-4">
      {pending.map((request) => (
        <div key={request.id} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Shop requested changes</p>
            <p className="text-xs text-slate-400">{formatDate(request.createdAt)}</p>
          </div>
          <p className="text-sm text-slate-200">{request.message}</p>
          <textarea
            className="input h-20"
            placeholder="Add context (optional)"
            value={notes[request.id] ?? ''}
            onChange={(event) => setNote(request.id, event.target.value)}
            disabled={submitting === request.id}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline text-sm"
              disabled={submitting === request.id}
              onClick={() => respond(request.id, 'changes_requested')}
            >
              Request changes
            </button>
            <button
              type="button"
              className="btn text-sm"
              disabled={submitting === request.id}
              onClick={() => respond(request.id, 'approved')}
            >
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
