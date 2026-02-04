"use client"
import { useEffect, useState } from 'react'

type AdminUserProfile = {
  slug?: string | null
  bio?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  websiteUrl?: string | null
  socialTwitter?: string | null
  socialInstagram?: string | null
  socialTikTok?: string | null
  socialYoutube?: string | null
  socialBluesky?: string | null
  socialFacebook?: string | null
  shippingName?: string | null
  shippingAddress1?: string | null
  shippingAddress2?: string | null
  shippingCity?: string | null
  shippingState?: string | null
  shippingPostal?: string | null
  shippingCountry?: string | null
  avatarImagePath?: string | null
}

type AdminUser = {
  id: string
  email: string
  name?: string | null
  isAdmin: boolean
  isSuspended: boolean
  emailVerified: boolean
}

type Props = {
  userId: string
}

export default function UserAccountEditor({ userId }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [user, setUser] = useState<AdminUser | null>(null)
  const [profile, setProfile] = useState<AdminUserProfile | null>(null)
  const [password, setPassword] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open || loaded) return
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/users/${userId}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Failed to load user')
        setUser(data.user as AdminUser)
        setProfile(data.profile as AdminUserProfile)
        setLoaded(true)
      } catch (err: any) {
        setError(err.message || 'Failed to load user')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [open, loaded, userId])

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(avatarFile)
    setAvatarPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [avatarFile])

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const form = new FormData()
      form.append('email', user.email)
      form.append('name', user.name || '')
      form.append('isAdmin', String(user.isAdmin))
      form.append('suspended', String(user.isSuspended))
      form.append('emailVerified', String(user.emailVerified))
      form.append('password', password || '')
      form.append('slug', profile?.slug || '')
      form.append('bio', profile?.bio || '')
      form.append('contactEmail', profile?.contactEmail || '')
      form.append('contactPhone', profile?.contactPhone || '')
      form.append('websiteUrl', profile?.websiteUrl || '')
      form.append('socialTwitter', profile?.socialTwitter || '')
      form.append('socialInstagram', profile?.socialInstagram || '')
      form.append('socialTikTok', profile?.socialTikTok || '')
      form.append('socialYoutube', profile?.socialYoutube || '')
      form.append('socialBluesky', profile?.socialBluesky || '')
      form.append('socialFacebook', profile?.socialFacebook || '')
      form.append('shippingName', profile?.shippingName || '')
      form.append('shippingAddress1', profile?.shippingAddress1 || '')
      form.append('shippingAddress2', profile?.shippingAddress2 || '')
      form.append('shippingCity', profile?.shippingCity || '')
      form.append('shippingState', profile?.shippingState || '')
      form.append('shippingPostal', profile?.shippingPostal || '')
      form.append('shippingCountry', profile?.shippingCountry || '')
      if (avatarFile) form.append('avatar', avatarFile)
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to save user')
      setUser(data.user as AdminUser)
      setProfile(data.profile as AdminUserProfile)
      setPassword('')
      setAvatarFile(null)
      setMessage('User updated.')
    } catch (err: any) {
      setError(err.message || 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
      <button
        type="button"
        className="text-sm px-3 py-1 rounded-md border border-white/10 hover:border-white/30"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? 'Close editor' : 'Edit account & profile'}
      </button>
      {open && (
        <div className="mt-3">
          {loading && <div className="text-xs text-slate-400">Loading user...</div>}
          {error && <div className="text-xs text-amber-300">{error}</div>}
          {message && <div className="text-xs text-emerald-300">{message}</div>}
          {user && profile && (
            <form onSubmit={onSave} className="mt-3 space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-white/10 bg-slate-900/60">
                  {avatarPreviewUrl ? (
                    <img className="w-full h-full object-cover" src={avatarPreviewUrl} alt="" />
                  ) : profile.avatarImagePath ? (
                    <img className="w-full h-full object-cover" src={`/files${profile.avatarImagePath}`} alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">No avatar</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Avatar</label>
                  <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Name</label>
                  <input className="input" value={user.name || ''} onChange={(e) => setUser({ ...user, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email</label>
                  <input className="input" type="email" value={user.email} onChange={(e) => setUser({ ...user, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">New password</label>
                  <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Profile slug</label>
                  <input className="input" value={profile.slug || ''} onChange={(e) => setProfile({ ...profile, slug: e.target.value })} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={user.isAdmin} onChange={(e) => setUser({ ...user, isAdmin: e.target.checked })} />
                  Admin
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={user.emailVerified} onChange={(e) => setUser({ ...user, emailVerified: e.target.checked })} />
                  Email verified
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={user.isSuspended} onChange={(e) => setUser({ ...user, isSuspended: e.target.checked })} />
                  Suspended
                </label>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Bio</label>
                <textarea className="input h-24" value={profile.bio || ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Public contact email</label>
                  <input className="input" type="email" value={profile.contactEmail || ''} onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Contact phone</label>
                  <input className="input" value={profile.contactPhone || ''} onChange={(e) => setProfile({ ...profile, contactPhone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Website</label>
                  <input className="input" value={profile.websiteUrl || ''} onChange={(e) => setProfile({ ...profile, websiteUrl: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Instagram</label>
                  <input className="input" value={profile.socialInstagram || ''} onChange={(e) => setProfile({ ...profile, socialInstagram: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Twitter / X</label>
                  <input className="input" value={profile.socialTwitter || ''} onChange={(e) => setProfile({ ...profile, socialTwitter: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">TikTok</label>
                  <input className="input" value={profile.socialTikTok || ''} onChange={(e) => setProfile({ ...profile, socialTikTok: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">YouTube</label>
                  <input className="input" value={profile.socialYoutube || ''} onChange={(e) => setProfile({ ...profile, socialYoutube: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Bluesky</label>
                  <input className="input" value={profile.socialBluesky || ''} onChange={(e) => setProfile({ ...profile, socialBluesky: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Facebook</label>
                  <input className="input" value={profile.socialFacebook || ''} onChange={(e) => setProfile({ ...profile, socialFacebook: e.target.value })} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Shipping name</label>
                  <input className="input" value={profile.shippingName || ''} onChange={(e) => setProfile({ ...profile, shippingName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Address line 1</label>
                  <input className="input" value={profile.shippingAddress1 || ''} onChange={(e) => setProfile({ ...profile, shippingAddress1: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Address line 2</label>
                  <input className="input" value={profile.shippingAddress2 || ''} onChange={(e) => setProfile({ ...profile, shippingAddress2: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">City</label>
                  <input className="input" value={profile.shippingCity || ''} onChange={(e) => setProfile({ ...profile, shippingCity: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">State / Province</label>
                  <input className="input" value={profile.shippingState || ''} onChange={(e) => setProfile({ ...profile, shippingState: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Postal code</label>
                  <input className="input" value={profile.shippingPostal || ''} onChange={(e) => setProfile({ ...profile, shippingPostal: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Country</label>
                  <input className="input" value={profile.shippingCountry || ''} onChange={(e) => setProfile({ ...profile, shippingCountry: e.target.value })} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="btn" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
                <span className="text-xs text-slate-400">Edits apply immediately.</span>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
