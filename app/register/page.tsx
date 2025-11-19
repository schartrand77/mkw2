"use client"
import { useState } from 'react'

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
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [lastEmail, setLastEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)
  const [resendErr, setResendErr] = useState<string | null>(null)
  const passwordsMatch = confirmPassword === '' || password === confirmPassword
  const canSubmit = Boolean(email && name.trim() && password && confirmPassword && passwordsMatch)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMsg(null)
    setResendMsg(null); setResendErr(null)
    if (!passwordsMatch) {
      await notify({ type: 'error', title: 'Password mismatch', message: 'Passwords must match.' })
      return
    }
    const normalizedEmail = email.trim().toLowerCase()
    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: normalizedEmail,
          name,
          password,
          confirmPassword,
        })
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const message = data?.error || 'Registration failed'
        throw new Error(message)
      }
      await notify({ type: 'success', title: 'Account created', message: 'Check your email to verify your account.' })
      const verifyNote = data?.message || 'Please check your inbox for the verification link.'
      setSuccessMsg(verifyNote)
      setLastEmail(normalizedEmail)
      setEmail('')
      setName('')
      setPassword('')
      setConfirmPassword('')
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
        {successMsg && (
          <div className="space-y-2">
            <div className="text-sm text-brand-400">{successMsg}</div>
            {lastEmail && (
              <div className="space-y-1">
                <button
                  type="button"
                  className="text-xs text-slate-200 underline hover:text-white disabled:opacity-60"
                  onClick={async () => {
                    setResending(true); setResendMsg(null); setResendErr(null)
                    try {
                      const res = await fetch('/api/register/resend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: lastEmail }),
                      })
                      const data = await res.json().catch(() => null)
                      if (!res.ok) throw new Error(data?.error || 'Failed to resend verification email')
                      setResendMsg(data?.message || 'Verification email resent.')
                    } catch (err: any) {
                      setResendErr(err.message || 'Failed to resend verification email')
                    } finally {
                      setResending(false)
                    }
                  }}
                  disabled={resending}
                >
                  {resending ? 'Resending...' : 'Didn’t get it? Resend verification email'}
                </button>
                {resendErr && <div className="text-xs text-amber-400">{resendErr}</div>}
                {resendMsg && <div className="text-xs text-emerald-300">{resendMsg}</div>}
              </div>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <label>Password</label>
            <button
              type="button"
              className="text-xs text-slate-300 hover:text-white"
              onClick={() => setShowPasswords((prev) => !prev)}
            >
              {showPasswords ? 'Hide password' : 'Show password'}
            </button>
          </div>
          <input
            className="input"
            type={showPasswords ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Confirm Password</label>
          <input
            className="input"
            type={showPasswords ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          {confirmPassword && !passwordsMatch && (
            <p className="text-xs text-amber-400 mt-1">Passwords do not match.</p>
          )}
        </div>
        <button className="btn" disabled={loading || !canSubmit}>{loading ? 'Creating...' : 'Create account'}</button>
      </form>
    </div>
  )
}
