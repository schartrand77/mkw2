"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

export default function OrganizationQuoteApproval({ organizationId, orderId }: { organizationId: string; orderId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote] = useState('')

  const submit = async (action: 'approve' | 'reject') => {
    if (busy) return
    setBusy(action)
    try {
      const res = await fetch(`/api/customer/organizations/${organizationId}/orders/${orderId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Unable to submit organization approval.')
      pushSessionNotification({
        type: 'success',
        title: action === 'approve' ? 'Quote approved' : 'Quote rejected',
        message: action === 'approve' ? 'Order moved into queue.' : 'Order was rejected.',
      })
      setNote('')
      router.refresh()
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Approval failed', message: err?.message || 'Unable to submit approval.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Organization approval</p>
      <textarea
        className="input text-xs min-h-[70px]"
        placeholder="Approval note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button type="button" className="btn btn-outline text-xs" disabled={busy !== null} onClick={() => submit('reject')}>
          {busy === 'reject' ? 'Rejecting...' : 'Reject quote'}
        </button>
        <button type="button" className="btn text-xs" disabled={busy !== null} onClick={() => submit('approve')}>
          {busy === 'approve' ? 'Approving...' : 'Approve quote'}
        </button>
      </div>
    </div>
  )
}
