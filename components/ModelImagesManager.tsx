"use client"
import { useCallback, useEffect, useMemo, useState } from 'react'
import { IMAGE_ACCEPT_ATTRIBUTE } from '@/lib/images'
import { MODEL_IMAGE_LIMIT } from '@/lib/model-images'
import { toPublicHref } from '@/lib/public-path'

async function pushNotify(payload: { type: 'success' | 'error' | 'info'; title?: string; message: string }) {
  try {
    const mod = await import('@/components/notifications/NotificationsProvider')
    mod.pushSessionNotification(payload)
  } catch {
    // ignore if notifications aren't available
  }
}

type ModelImage = { id: string; filePath: string; caption: string | null }

type Props = {
  modelId: string
  initialCover?: string | null
  resourceBase?: string
}

export default function ModelImagesManager({ modelId, initialCover, resourceBase = '/api/models' }: Props) {
  const normalizedBase = useMemo(() => resourceBase.replace(/\/$/, ''), [resourceBase])
  const collectionEndpoint = useMemo(() => `${normalizedBase}/${modelId}/images`, [normalizedBase, modelId])
  const itemEndpoint = useCallback((imageId: string) => `${collectionEndpoint}/${imageId}`, [collectionEndpoint])

  const [images, setImages] = useState<ModelImage[]>([])
  const [coverPath, setCoverPath] = useState<string | null>(initialCover || null)
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({})
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [setCover, setSetCover] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(collectionEndpoint, { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to load images')
    const data = await res.json()
    setImages(data.images)
    setCoverPath(data.coverImagePath || null)
    const drafts: Record<string, string> = {}
    data.images.forEach((img: ModelImage) => { drafts[img.id] = img.caption || '' })
    setCaptionDrafts(drafts)
  }, [collectionEndpoint])

  useEffect(() => {
    load().catch(() => setError('Failed to load images'))
  }, [load])

  const resetForm = () => {
    setFile(null)
    setCaption('')
    setSetCover(true)
  }

  const readErrorMessage = async (res: Response) => {
    try {
      const text = await res.text()
      if (!text) return `${res.status} ${res.statusText}`
      try {
        const data = JSON.parse(text)
        if (data?.error) return data.error
        return text
      } catch {
        return text
      }
    } catch {
      return `${res.status} ${res.statusText}`
    }
  }

  const upload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (images.length >= MODEL_IMAGE_LIMIT) {
      setError(`Maximum of ${MODEL_IMAGE_LIMIT} photos reached. Remove one to add another.`)
      return
    }
    if (!file) {
      setError('Select an image first')
      return
    }
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      if (caption.trim()) fd.append('caption', caption.trim())
      if (setCover) fd.append('setCover', '1')
      const res = await fetch(collectionEndpoint, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await readErrorMessage(res))
      await load()
      resetForm()
      await pushNotify({ type: 'success', title: 'Photo uploaded', message: 'Image added to gallery.' })
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const updateCaption = async (id: string) => {
    const caption = captionDrafts[id] || ''
    const res = await fetch(itemEndpoint(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    })
    if (!res.ok) {
      setError(await readErrorMessage(res))
      return
    }
    await load()
    await pushNotify({ type: 'success', title: 'Caption saved', message: 'Caption updated.' })
  }

  const setAsCover = async (id: string) => {
    const res = await fetch(itemEndpoint(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setCover: true }),
    })
    if (!res.ok) {
      setError(await readErrorMessage(res))
      return
    }
    await load()
    await pushNotify({ type: 'success', title: 'Cover updated', message: 'Photo set as cover image.' })
  }

  const remove = async (id: string) => {
    if (!confirm('Remove this image?')) return
    const res = await fetch(itemEndpoint(id), { method: 'DELETE' })
    if (!res.ok) {
      setError(await readErrorMessage(res))
      return
    }
    await load()
    await pushNotify({ type: 'info', title: 'Photo removed', message: 'Image deleted from gallery.' })
  }

  const limitReached = images.length >= MODEL_IMAGE_LIMIT

  return (
    <div className="space-y-6">
      <form onSubmit={upload} className="glass p-4 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add real-life photo</h2>
          <div className="text-xs text-slate-400">{images.length}/{MODEL_IMAGE_LIMIT}</div>
        </div>
        <p className="text-xs text-slate-400">
          Show actual prints of this model. JPEG, PNG, and other common formats are supported.
        </p>
        {error && <div className="text-amber-400 text-sm">{error}</div>}
        <input
          type="file"
          accept={IMAGE_ACCEPT_ATTRIBUTE}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={limitReached}
        />
        <input className="input" placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={setCover} onChange={(e) => setSetCover(e.target.checked)} />
          Use as cover thumbnail
        </label>
        {limitReached && (
          <div className="text-xs text-amber-300">You have reached the {MODEL_IMAGE_LIMIT}-photo limit.</div>
        )}
        <button className="btn" disabled={busy || limitReached}>{busy ? 'Uploading…' : 'Upload'}</button>
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Existing images</h2>
        {images.length === 0 && <p className="text-sm text-slate-400">No images uploaded yet.</p>}
        <div className="grid md:grid-cols-2 gap-4">
          {images.map((img) => {
            const publicSrc = toPublicHref(img.filePath)
            return (
              <div key={img.id} className="glass rounded-xl overflow-hidden border border-white/10">
                {publicSrc ? (
                  <img src={publicSrc} alt={img.caption || 'Model image'} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="w-full aspect-video bg-slate-900/60 flex items-center justify-center text-slate-500 text-sm">Image unavailable</div>
                )}
                <div className="p-3 space-y-2">
                  {coverPath === img.filePath && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-200 border border-brand-500/40">Cover</span>}
                  <input
                    className="input"
                    value={captionDrafts[img.id] ?? ''}
                    onChange={(e) => setCaptionDrafts((prev) => ({ ...prev, [img.id]: e.target.value }))}
                  />
                  <div className="flex gap-2 text-sm">
                    <button type="button" className="btn flex-1" onClick={() => updateCaption(img.id)}>Save caption</button>
                    <button type="button" className="px-3 py-2 rounded-md border border-white/10 flex-1" onClick={() => setAsCover(img.id)}>Set cover</button>
                  </div>
                  <button type="button" className="px-3 py-2 rounded-md border border-red-400/40 text-red-300 w-full" onClick={() => remove(img.id)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
