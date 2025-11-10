"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Profile = { slug: string; bio?: string | null; avatarImagePath?: string | null }
type User = { name?: string | null; email: string }

export default function EditProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load profile')
        const data = await res.json() as { profile: Profile, user: User }
        setName(data.user?.name || '')
        setSlug(data.profile?.slug || '')
        setBio((data.profile?.bio as string) || '')
        setAvatarUrl(data.profile?.avatarImagePath ? `/files${data.profile.avatarImagePath}` : null)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('slug', slug)
      fd.append('bio', bio)
      if (avatar) fd.append('avatar', avatar)
      const res = await fetch('/api/profile', { method: 'PATCH', body: fd })
      if (res.status === 409) {
        setError('Slug already taken. Please choose another.')
        return
      }
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const newSlug = data.profile?.slug || slug
      router.push(`/u/${newSlug}`)
    } catch (err: any) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Edit Profile</h1>
      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 glass p-6 rounded-xl">
          {error && <div className="text-amber-400 text-sm">{error}</div>}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border border-white/10 bg-slate-900/40">
              {avatar ? (
                <img className="w-full h-full object-cover" src={URL.createObjectURL(avatar)} />
              ) : avatarUrl ? (
                <img className="w-full h-full object-cover" src={avatarUrl} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">No avatar</div>
              )}
            </div>
            <div>
              <label className="block text-sm mb-1">Avatar</label>
              <input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Profile URL</label>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">/u/</span>
              <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
            <p className="text-xs text-slate-400 mt-1">Allowed: lowercase letters, numbers, hyphens</p>
          </div>
          <div>
            <label className="block text-sm mb-1">Bio</label>
            <textarea className="input h-28" value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button disabled={saving} className="btn">{saving ? 'Saving...' : 'Save changes'}</button>
          </div>
        </form>
      )}
    </div>
  )
}

