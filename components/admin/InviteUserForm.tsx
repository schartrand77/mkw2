"use client"
import { useState, type FormEvent } from 'react'

type InviteResponse = {
  ok?: boolean
  error?: string
  discordSent?: boolean
  loginUrl?: string
}

export default function InviteUserForm() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [discordSent, setDiscordSent] = useState<boolean | null>(null)
  const [loginUrl, setLoginUrl] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    setError(null)
    setDiscordSent(null)
    setLoginUrl(null)
    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name || undefined }),
      })
      const data = await res.json().catch(() => ({})) as InviteResponse
      if (!res.ok) throw new Error(data?.error || 'Failed to invite user')
      setMessage('Invite created. User is pre-approved.')
      setDiscordSent(typeof data.discordSent === 'boolean' ? data.discordSent : null)
      setLoginUrl(data.loginUrl || null)
      setEmail('')
      setName('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="text-sm font-semibold">Invite user</div>
      <p className="text-xs text-slate-400 mt-1">
        Creates a pre-approved account and sends a magic login link.
      </p>
      <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-[minmax(200px,1fr)_minmax(160px,0.7fr)_auto]">
        <input
          type="email"
          required
          placeholder="email@example.com"
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
        <input
          type="text"
          placeholder="Name (optional)"
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
        />
        <button
          type="submit"
          className="rounded-md border border-white/10 px-4 py-2 text-sm hover:border-white/30 disabled:opacity-50"
          disabled={pending}
        >
          {pending ? 'Inviting...' : 'Invite'}
        </button>
      </form>
      {(message || error || discordSent !== null || loginUrl) && (
        <div className="mt-3 text-xs text-slate-300">
          {message && <div className="text-emerald-300">{message}</div>}
          {loginUrl && (
            <div>
              Login link: <a className="text-brand-300 underline" href={loginUrl} target="_blank" rel="noreferrer">{loginUrl}</a>
            </div>
          )}
          {discordSent === false && <div className="text-amber-300">Discord notification not sent.</div>}
          {error && <div className="text-amber-300">{error}</div>}
        </div>
      )}
    </div>
  )
}
