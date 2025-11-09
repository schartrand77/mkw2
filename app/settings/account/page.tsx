"use client"
import { useState } from 'react'

export default function AccountSettingsPage() {
  const [email, setEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState<string | null>(null)
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passMsg, setPassMsg] = useState<string | null>(null)
  const [passErr, setPassErr] = useState<string | null>(null)
  const [score, setScore] = useState<number | null>(null)

  async function loadZXCVBN() {
    const mod = await import('zxcvbn')
    return mod.default || (mod as any)
  }

  const updateEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailMsg(null); setEmailErr(null)
    try {
      const res = await fetch('/api/account/email/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      if (res.status === 409) { setEmailErr('Email already in use.'); return }
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to request verification')
      const data = await res.json()
      setEmailMsg('Verification email sent. (Dev: ' + (data.verifyUrl || '') + ')')
    } catch (e: any) {
      setEmailErr(e.message)
    }
  }

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassMsg(null); setPassErr(null)
    try {
      const res = await fetch('/api/account/password', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update password')
      setPassMsg('Password updated successfully.')
      setCurrentPassword(''); setNewPassword('')
      setScore(null)
    } catch (e: any) {
      setPassErr(e.message)
    }
  }

  const onNewPasswordChange = async (val: string) => {
    setNewPassword(val)
    try {
      const z = await loadZXCVBN()
      const res = z(val)
      setScore(res.score)
    } catch {
      setScore(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Account Settings</h1>
      <form onSubmit={updateEmail} className="glass p-6 rounded-xl space-y-3">
        <h2 className="font-semibold">Update Email</h2>
        {emailErr && <div className="text-amber-400 text-sm">{emailErr}</div>}
        {emailMsg && <div className="text-green-400 text-sm">{emailMsg}</div>}
        <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn">Save Email</button>
      </form>

      <form onSubmit={updatePassword} className="glass p-6 rounded-xl space-y-3">
        <h2 className="font-semibold">Change Password</h2>
        {passErr && <div className="text-amber-400 text-sm">{passErr}</div>}
        {passMsg && <div className="text-green-400 text-sm">{passMsg}</div>}
        <div>
          <label className="block text-sm mb-1">Current Password</label>
          <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">New Password (min 8 chars)</label>
          <input className="input" type="password" value={newPassword} onChange={(e) => onNewPasswordChange(e.target.value)} />
          {score !== null && (
            <div className="mt-1 text-xs text-slate-400">Strength: {[ 'Very weak', 'Weak', 'Fair', 'Good', 'Strong' ][Math.max(0, Math.min(4, score))]}</div>
          )}
        </div>
        <button className="btn">Update Password</button>
      </form>
    </div>
  )
}
