"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'

export default function RevisionUploader({ orderId }: { orderId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file) {
      pushSessionNotification({ type: 'error', title: 'Missing file', message: 'Choose a revision file first.' })
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      if (note.trim()) form.append('note', note.trim())
      const res = await fetch(`/api/customer/orders/${orderId}/revision`, { method: 'POST', body: form })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || 'Upload failed.')
      }
      setFile(null)
      setNote('')
      const input = document.getElementById(`revision-file-${orderId}`) as HTMLInputElement | null
      if (input) input.value = ''
      pushSessionNotification({ type: 'success', title: 'Revision uploaded', message: 'We will review the updated file.' })
      router.refresh()
    } catch (err: any) {
      pushSessionNotification({ type: 'error', title: 'Upload failed', message: err?.message || 'Unable to upload revision.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm text-slate-300 mb-1" htmlFor={`revision-file-${orderId}`}>Upload new revision (STL/ZIP)</label>
        <input
          id={`revision-file-${orderId}`}
          type="file"
          accept=".stl,.obj,.3mf,.zip"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={uploading}
        />
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1" htmlFor={`revision-note-${orderId}`}>Notes</label>
        <textarea
          id={`revision-note-${orderId}`}
          className="input h-20"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe what changed so we can review quicker"
          disabled={uploading}
        />
      </div>
      <button type="submit" className="btn w-full sm:w-auto justify-center disabled:opacity-50" disabled={uploading}>
        {uploading ? 'Uploading...' : 'Submit revision'}
      </button>
    </form>
  )
}
