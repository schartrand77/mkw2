"use client"
import { useState } from 'react'

type Props = {
  userId: string
  initialDiscount: number
  initialFriendsAndFamily: boolean
  initialFriendsAndFamilyPercent: number
}

export default function UserDiscountControls({
  userId,
  initialDiscount,
  initialFriendsAndFamily,
  initialFriendsAndFamilyPercent,
}: Props) {
  const [discount, setDiscount] = useState(initialDiscount)
  const [friendsAndFamily, setFriendsAndFamily] = useState(initialFriendsAndFamily)
  const [friendsAndFamilyPercent, setFriendsAndFamilyPercent] = useState(initialFriendsAndFamilyPercent)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/users/discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          discountPercent: Number(discount) || 0,
          isFriendsAndFamily: friendsAndFamily,
          friendsAndFamilyPercent: Number(friendsAndFamilyPercent) || 0,
        }),
      })
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const data = await res.json()
      setDiscount(data.discount?.discountPercent ?? 0)
      setFriendsAndFamilyPercent(data.discount?.friendsAndFamilyPercent ?? 0)
      setFriendsAndFamily(data.discount?.isFriendsAndFamily ?? false)
      setMessage('Saved')
    } catch (err: any) {
      setMessage(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-2 text-xs sm:text-sm sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
      <label className="flex flex-col gap-1">
        <span className="text-slate-400">Custom discount (%)</span>
        <input
          type="number"
          min="0"
          max="95"
          step="0.5"
          className="input text-sm"
          value={discount}
          onChange={(e) => setDiscount(Number(e.target.value))}
        />
      </label>
      <label className="flex items-center gap-2 mt-2 sm:mt-0">
        <input
          type="checkbox"
          checked={friendsAndFamily}
          onChange={(e) => setFriendsAndFamily(e.target.checked)}
        />
        <span>Friends & Family</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-slate-400">F&F discount (%)</span>
        <input
          type="number"
          min="0"
          max="95"
          step="0.5"
          className="input text-sm"
          value={friendsAndFamilyPercent}
          onChange={(e) => setFriendsAndFamilyPercent(Number(e.target.value))}
          disabled={!friendsAndFamily}
        />
      </label>
      <div className="flex items-end gap-2">
        <button type="submit" className="btn px-4 py-2 text-sm" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        {message && <span className="text-xs text-slate-400">{message}</span>}
      </div>
    </form>
  )
}
