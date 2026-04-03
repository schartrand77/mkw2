'use client'

import { useState } from 'react'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

type Props = {
  orderId: string
  existingName?: string | null
  existingPath?: string | null
}

export default function SlicerProfileUploader({ orderId, existingName, existingPath }: Props) {
  const [pending, setPending] = useState(false)

  const onUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const input = form.querySelector('input[type="file"]') as HTMLInputElement | null
    if (!input || !input.files || input.files.length === 0) {
      pushSessionNotification({ type: 'error', title: 'No file selected', message: 'Choose a slicer profile file to upload.' })
      return
    }
    const file = input.files[0]
    const data = new FormData()
    data.append('file', file)
    setPending(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/slicer-profile`, { method: 'POST', body: data })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Upload failed')
      pushSessionNotification({ type: 'success', title: 'Profile attached', message: body?.profile?.slicerProfileName || 'Slicer profile uploaded.' })
      form.reset()
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Upload failed', message: err?.message || 'Unable to attach profile.' })
    } finally {
      setPending(false)
    }
  }

  const href = existingPath ? `/files/${existingPath}`.replace(/\\/g, '/').replace(/\/+/g, '/') : null

  return (
    <div className="space-y-2">
      {existingName ? (
        <div className="text-xs text-slate-400">
          Attached: {existingName}
          {href ? (
            <a className="ml-2 text-brand-400 underline" href={href} target="_blank" rel="noreferrer">Download</a>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No slicer profile attached yet.</p>
      )}
      <form onSubmit={onUpload} className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="file"
          className="text-xs"
          accept=".3mf,.ini,.cfg,.json,.txt"
          disabled={pending}
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-sm disabled:opacity-60"
          disabled={pending}
        >
          {pending ? 'Uploading...' : 'Upload profile'}
        </button>
      </form>
    </div>
  )
}
