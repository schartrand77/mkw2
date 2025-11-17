"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'

async function notify(payload: { type: 'success' | 'error' | 'info'; title?: string; message: string }) {
  try {
    const mod = await import('@/components/notifications/NotificationsProvider')
    mod.pushSessionNotification(payload)
  } catch {}
}

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, name, password })
      })
      if (!res.ok) throw new Error(await res.text())
      await notify({ type: 'success', title: 'Account created', message: 'Welcome to MakerWorks!' })
      if (typeof window !== 'undefined') {
        window.location.href = '/discover'
      } else {
        router.replace('/discover')
      }
    } catch (err: any) {
      await notify({ type: 'error', title: 'Registration failed', message: err.message || 'Registration failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Create an account</h1>
      <form onSubmit={submit} className="space-y-4 glass p-6 rounded-xl">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
      </form>
    </div>
  )
}
