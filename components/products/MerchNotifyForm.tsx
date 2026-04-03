"use client"

import { FormEvent, useState } from 'react'

type Props = {
  merchItemId: string
  title: string
}

export default function MerchNotifyForm({ merchItemId, title }: Props) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/merch/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchItemId,
          email: email.trim(),
          name: name.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to save notification request.')
      setSent(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to save notification request.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return <div className="text-xs text-emerald-300">We will email you when {title} is available.</div>
  }

  return (
    <form className="space-y-2" onSubmit={onSubmit}>
      <div className="text-xs text-slate-300">Notify me when available</div>
      <input
        className="input text-sm"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="input text-sm"
        type="text"
        placeholder="Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {error && <div className="text-xs text-rose-300">{error}</div>}
      <button type="submit" className="inline-flex rounded-md border border-white/20 px-3 py-1.5 text-xs hover:border-white/40 disabled:opacity-60" disabled={busy}>
        {busy ? 'Saving...' : 'Notify me'}
      </button>
    </form>
  )
}
