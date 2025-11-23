"use client"
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BRAND_NAME } from '@/lib/brand'

async function notify(payload: { type: 'success' | 'error' | 'info'; title?: string; message: string }) {
  try {
    const mod = await import('@/components/notifications/NotificationsProvider')
    mod.pushSessionNotification(payload)
  } catch {}
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })
      if (!res.ok) throw new Error(await res.text())
      await notify({ type: 'success', title: 'Signed in', message: 'Welcome back!' })
      setEmail('')
      setPassword('')
      if (typeof window !== 'undefined') {
        window.location.href = '/discover'
      } else {
        router.replace('/discover')
      }
    } catch (err: any) {
      await notify({ type: 'error', title: 'Login failed', message: err.message || 'Login failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <form onSubmit={submit} className="space-y-4 glass p-6 rounded-xl">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-3 pt-2">
          <button className="btn w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
          <Link
            href="/register"
            className="inline-flex w-full items-center justify-center rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/10"
          >
            Join {BRAND_NAME}
          </Link>
        </div>
      </form>
    </div>
  )
}

