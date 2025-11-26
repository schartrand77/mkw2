"use client"
import { useState } from 'react'

type Props = {
  userId: string
  initialSuspended: boolean
  initialEmailVerified: boolean
  isAdmin: boolean
}

export default function UserAdminActions({ userId, initialSuspended, initialEmailVerified, isAdmin }: Props) {
  const [suspended, setSuspended] = useState(initialSuspended)
  const [emailVerified, setEmailVerified] = useState(initialEmailVerified)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleSuspend = async () => {
    setPending(true); setMessage(null); setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: !suspended })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to update status')
      setSuspended(data?.user?.isSuspended ?? !suspended)
      setMessage(data?.user?.isSuspended ? 'User suspended' : 'User reactivated')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPending(false)
    }
  }

  const markEmailVerified = async () => {
    if (emailVerified) return
    setPending(true); setMessage(null); setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailVerified: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to verify email')
      setEmailVerified(data?.user?.emailVerified ?? true)
      setMessage('Email marked as verified')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPending(false)
    }
  }

  const deleteUser = async () => {
    if (isAdmin) return
    if (!window.confirm('Delete this user and all of their content? This cannot be undone.')) return
    setPending(true); setMessage(null); setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to delete user')
      setMessage('User deleted. Refresh to update the list.')
      setTimeout(() => window.location.reload(), 800)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs ${suspended ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
          {suspended ? 'Suspended' : 'Active'}
        </span>
        <button
          type="button"
          className="px-3 py-1 rounded-md border border-white/10 hover:border-white/30 disabled:opacity-50"
          onClick={toggleSuspend}
          disabled={pending}
        >
          {suspended ? 'Unsuspend' : 'Suspend'}
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded-md border border-red-500/40 text-red-200 hover:border-red-400 disabled:opacity-50"
          onClick={deleteUser}
          disabled={pending || isAdmin}
          title={isAdmin ? 'Cannot delete admin accounts' : 'Delete user'}
        >
          Delete
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs ${emailVerified ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}>
          {emailVerified ? 'Email verified' : 'Email pending'}
        </span>
        <button
          type="button"
          className="px-3 py-1 rounded-md border border-white/10 hover:border-white/30 disabled:opacity-50"
          onClick={markEmailVerified}
          disabled={pending || emailVerified}
          title={emailVerified ? 'Email already verified' : 'Mark email as verified'}
        >
          {emailVerified ? 'Verified' : 'Confirm email'}
        </button>
      </div>
      {error && <div className="text-xs text-amber-400">{error}</div>}
      {message && <div className="text-xs text-emerald-300">{message}</div>}
    </div>
  )
}
