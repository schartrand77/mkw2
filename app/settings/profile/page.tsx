"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IMAGE_ACCEPT_ATTRIBUTE } from '@/lib/images'
import { BRAND_HANDLE } from '@/lib/brand'

async function notify(payload: { type: 'success' | 'error' | 'info'; title?: string; message: string }) {
  try {
    const mod = await import('@/components/notifications/NotificationsProvider')
    mod.pushSessionNotification(payload)
  } catch {}
}

type Profile = { slug: string; bio?: string | null; avatarImagePath?: string | null }
type User = { name?: string | null; email: string }
type ProfileExtras = {
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
}

export default function EditProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [socialTwitter, setSocialTwitter] = useState('')
  const [socialInstagram, setSocialInstagram] = useState('')
  const [socialTikTok, setSocialTikTok] = useState('')
  const [socialYoutube, setSocialYoutube] = useState('')
  const [socialBluesky, setSocialBluesky] = useState('')
  const [socialFacebook, setSocialFacebook] = useState('')
  const [shippingName, setShippingName] = useState('')
  const [shippingAddress1, setShippingAddress1] = useState('')
  const [shippingAddress2, setShippingAddress2] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingState, setShippingState] = useState('')
  const [shippingPostal, setShippingPostal] = useState('')
  const [shippingCountry, setShippingCountry] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load profile')
        const data = await res.json() as { profile: Profile & ProfileExtras, user: User }
        setName(data.user?.name || '')
        setSlug(data.profile?.slug || '')
        setBio((data.profile?.bio as string) || '')
        setAvatarUrl(data.profile?.avatarImagePath ? `/files${data.profile.avatarImagePath}` : null)
        setContactEmail(data.profile?.contactEmail || data.user?.email || '')
        setContactPhone(data.profile?.contactPhone || '')
        setWebsiteUrl(data.profile?.websiteUrl || '')
        setSocialTwitter(data.profile?.socialTwitter || '')
        setSocialInstagram(data.profile?.socialInstagram || '')
        setSocialTikTok(data.profile?.socialTikTok || '')
        setSocialYoutube(data.profile?.socialYoutube || '')
        setSocialBluesky(data.profile?.socialBluesky || '')
        setSocialFacebook(data.profile?.socialFacebook || '')
        setShippingName(data.profile?.shippingName || data.user?.name || '')
        setShippingAddress1(data.profile?.shippingAddress1 || '')
        setShippingAddress2(data.profile?.shippingAddress2 || '')
        setShippingCity(data.profile?.shippingCity || '')
        setShippingState(data.profile?.shippingState || '')
        setShippingPostal(data.profile?.shippingPostal || '')
        setShippingCountry(data.profile?.shippingCountry || '')
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
      fd.append('contactEmail', contactEmail)
      fd.append('contactPhone', contactPhone)
      fd.append('websiteUrl', websiteUrl)
      fd.append('socialTwitter', socialTwitter)
      fd.append('socialInstagram', socialInstagram)
      fd.append('socialTikTok', socialTikTok)
      fd.append('socialYoutube', socialYoutube)
      fd.append('socialBluesky', socialBluesky)
      fd.append('socialFacebook', socialFacebook)
      fd.append('shippingName', shippingName)
      fd.append('shippingAddress1', shippingAddress1)
      fd.append('shippingAddress2', shippingAddress2)
      fd.append('shippingCity', shippingCity)
      fd.append('shippingState', shippingState)
      fd.append('shippingPostal', shippingPostal)
      fd.append('shippingCountry', shippingCountry)
      if (avatar) fd.append('avatar', avatar)
      const res = await fetch('/api/profile', { method: 'PATCH', body: fd })
      if (res.status === 409) {
        setError('Slug already taken. Please choose another.')
        return
      }
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const newSlug = data.profile?.slug || slug
      const savedAvatarPath: string | undefined = data.profile?.avatarImagePath
      if (savedAvatarPath) {
        const normalized = savedAvatarPath.startsWith('/files')
          ? savedAvatarPath
          : `/files${savedAvatarPath}`
        setAvatar(null)
        setAvatarUrl(normalized)
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('mwv2:avatarUrl', normalized)
            window.dispatchEvent(new CustomEvent('mwv2:avatar:update', { detail: normalized }))
          } catch {}
        }
      }
      await notify({ type: 'success', title: 'Profile updated', message: 'Your profile changes are live.' })
      router.refresh()
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
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <div className="text-amber-400 text-sm">{error}</div>}
          <div className="glass p-6 rounded-xl space-y-4">
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
                <input type="file" accept={IMAGE_ACCEPT_ATTRIBUTE} onChange={(e) => setAvatar(e.target.files?.[0] || null)} />
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
          </div>

          <div className="glass p-6 rounded-xl space-y-3">
            <h2 className="text-lg font-semibold">Contact information</h2>
            <div>
              <label className="block text-sm mb-1">Public contact email</label>
              <input className="input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-sm mb-1">Phone number</label>
              <input className="input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+1 (555) 555-0100" />
            </div>
            <div>
              <label className="block text-sm mb-1">Website / Portfolio</label>
              <input className="input" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://your-site.com" />
            </div>
          </div>

  <div className="glass p-6 rounded-xl space-y-3">
    <h2 className="text-lg font-semibold">Social accounts</h2>
    <p className="text-xs text-slate-400">Links can be full URLs or handles. Leave blank to hide.</p>
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-sm mb-1">Instagram</label>
        <input className="input" value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} placeholder={BRAND_HANDLE} />
      </div>
      <div>
        <label className="block text-sm mb-1">Twitter / X</label>
        <input className="input" value={socialTwitter} onChange={(e) => setSocialTwitter(e.target.value)} placeholder={BRAND_HANDLE} />
      </div>
      <div>
        <label className="block text-sm mb-1">TikTok</label>
        <input className="input" value={socialTikTok} onChange={(e) => setSocialTikTok(e.target.value)} placeholder={BRAND_HANDLE} />
      </div>
      <div>
        <label className="block text-sm mb-1">YouTube</label>
        <input className="input" value={socialYoutube} onChange={(e) => setSocialYoutube(e.target.value)} placeholder="https://youtube.com/..." />
      </div>
      <div>
        <label className="block text-sm mb-1">Bluesky</label>
        <input className="input" value={socialBluesky} onChange={(e) => setSocialBluesky(e.target.value)} placeholder="@handle.bsky.social" />
      </div>
      <div>
        <label className="block text-sm mb-1">Facebook</label>
        <input className="input" value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} placeholder="https://facebook.com/..." />
      </div>
    </div>
  </div>

          <div className="glass p-6 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Shipping address</h2>
              <span className="text-xs uppercase tracking-[0.25em] text-slate-500">Used at checkout</span>
            </div>
            <div>
              <label className="block text-sm mb-1">Recipient name</label>
              <input className="input" value={shippingName} onChange={(e) => setShippingName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="block text-sm mb-1">Address line 1</label>
              <input className="input" value={shippingAddress1} onChange={(e) => setShippingAddress1(e.target.value)} placeholder="Street address" />
            </div>
            <div>
              <label className="block text-sm mb-1">Address line 2</label>
              <input className="input" value={shippingAddress2} onChange={(e) => setShippingAddress2(e.target.value)} placeholder="Apartment, suite, etc. (optional)" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">City</label>
                <input className="input" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">State / Province</label>
                <input className="input" value={shippingState} onChange={(e) => setShippingState(e.target.value)} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Postal code</label>
                <input className="input" value={shippingPostal} onChange={(e) => setShippingPostal(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Country</label>
                <input className="input" value={shippingCountry} onChange={(e) => setShippingCountry(e.target.value)} placeholder="Canada" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button disabled={saving} className="btn">{saving ? 'Saving...' : 'Save changes'}</button>
          </div>
        </form>
      )}
    </div>
  )
}
