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

function normalizeTurns(value: number) {
  if (!Number.isFinite(value)) return 0
  const steps = Math.round(value)
  if (steps === 0) return 0
  const mod = ((steps % 4) + 4) % 4
  return mod > 2 ? mod - 4 : mod
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
  const coverEndpoint = useMemo(() => `${normalizedBase}/${modelId}/cover`, [normalizedBase, modelId])

  const [images, setImages] = useState<ModelImage[]>([])
  const [coverPath, setCoverPath] = useState<string | null>(initialCover || null)
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({})
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [setCover, setSetCover] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cacheBuster, setCacheBuster] = useState(() => Date.now())
  const [pendingRotations, setPendingRotations] = useState<Record<string, number>>({})
  const [coverRotation, setCoverRotation] = useState(0)
  const [savingRotationId, setSavingRotationId] = useState<string | null>(null)
  const [savingCover, setSavingCover] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(collectionEndpoint, { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to load images')
    const data = await res.json()
    setImages(data.images)
    setCoverPath(data.coverImagePath || null)
    const drafts: Record<string, string> = {}
    data.images.forEach((img: ModelImage) => { drafts[img.id] = img.caption || '' })
    setCaptionDrafts(drafts)
    setPendingRotations({})
    setCoverRotation(0)
    setCacheBuster(Date.now())
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

  const adjustTurns = (current: number, direction: 'left' | 'right') => normalizeTurns(current + (direction === 'left' ? -1 : 1))

  const queueRotation = (id: string, direction: 'left' | 'right') => {
    setPendingRotations((prev) => ({
      ...prev,
      [id]: adjustTurns(prev[id] || 0, direction),
    }))
  }

  const saveRotation = async (id: string) => {
    const turns = pendingRotations[id] || 0
    if (!turns || savingRotationId === id) return
    setSavingRotationId(id)
    try {
      const res = await fetch(itemEndpoint(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotateTurns: turns }),
      })
      if (!res.ok) {
        setError(await readErrorMessage(res))
        return
      }
      await load()
      setPendingRotations((prev) => ({ ...prev, [id]: 0 }))
      await pushNotify({
        type: 'info',
        title: 'Image rotated',
        message: turns < 0 ? 'Rotated counter-clockwise.' : 'Rotated clockwise.',
      })
    } finally {
      setSavingRotationId((current) => (current === id ? null : current))
    }
  }

  const queueCoverRotation = (direction: 'left' | 'right') => {
    setCoverRotation((prev) => adjustTurns(prev, direction))
  }

  const saveCoverRotation = async () => {
    if (!coverRotation || savingCover) return
    setSavingCover(true)
    try {
      const res = await fetch(coverEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotateTurns: coverRotation }),
      })
      if (!res.ok) {
        setError(await readErrorMessage(res))
        return
      }
      await load()
      setCoverRotation(0)
      await pushNotify({
        type: 'info',
        title: 'Cover updated',
        message: coverRotation < 0 ? 'Cover rotated counter-clockwise.' : 'Cover rotated clockwise.',
      })
    } finally {
      setSavingCover(false)
    }
  }

  const rotateCover = async (direction: 'left' | 'right') => {
    const res = await fetch(coverEndpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotate: direction }),
    })
    if (!res.ok) {
      setError(await readErrorMessage(res))
      return
    }
    await load()
    await pushNotify({
      type: 'info',
      title: 'Cover rotated',
      message: direction === 'left' ? 'Cover rotated counter-clockwise.' : 'Cover rotated clockwise.',
    })
  }

  const limitReached = images.length >= MODEL_IMAGE_LIMIT
  const galleryImages = coverPath ? images.filter((img) => img.filePath !== coverPath) : images
  const coverSrc = coverPath ? toPublicHref(coverPath) : null

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
        {coverSrc && (
          <div className="glass rounded-xl overflow-hidden border border-white/10">
            <div className="aspect-video w-full bg-black/40 flex items-center justify-center overflow-hidden">
              <img
                src={`${coverSrc}?v=${cacheBuster}`}
                alt="Cover image"
                className={`transition-transform duration-150 max-h-full max-w-full ${Math.abs(coverRotation) % 2 ? 'object-contain' : 'object-cover'} pointer-events-none select-none`}
                style={coverRotation ? { transform: `rotate(${coverRotation * 90}deg)` } : undefined}
              />
            </div>
            <div className="p-3 space-y-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-200 border border-brand-500/40">Current cover</span>
              <p className="text-sm text-slate-400">This is the thumbnail shown across Discover and Model pages.</p>
              <div className="flex gap-2 text-xs">
                <button type="button" className="px-3 py-2 rounded-md border border-white/10 flex-1" onClick={() => queueCoverRotation('left')}>Rotate left</button>
                <button type="button" className="px-3 py-2 rounded-md border border-white/10 flex-1" onClick={() => queueCoverRotation('right')}>Rotate right</button>
              </div>
              <button
                type="button"
                className="px-3 py-2 rounded-md border border-brand-500/60 text-sm"
                disabled={!coverRotation || savingCover}
                onClick={saveCoverRotation}
              >
                {savingCover ? 'Saving...' : 'Save rotation'}
              </button>
              {coverRotation !== 0 && <p className="text-[11px] text-amber-300">Rotation pending - don't forget to save.</p>}
            </div>
          </div>
        )}
        {galleryImages.length === 0 && <p className="text-sm text-slate-400">No additional gallery images uploaded yet.</p>}
        <div className="grid md:grid-cols-2 gap-4">
          {galleryImages.map((img) => {
            const publicSrc = toPublicHref(img.filePath)
            const displaySrc = publicSrc ? `${publicSrc}?v=${cacheBuster}` : null
            const turns = pendingRotations[img.id] || 0
            const savingThis = savingRotationId === img.id
            return (
              <div key={img.id} className="glass rounded-xl overflow-hidden border border-white/10">
                {displaySrc ? (
                  <div className="aspect-video w-full bg-black/30 flex items-center justify-center overflow-hidden">
                    <img
                      src={displaySrc}
                      alt={img.caption || 'Model image'}
                      className={`transition-transform duration-150 max-h-full max-w-full pointer-events-none select-none ${Math.abs(turns) % 2 ? 'object-contain' : 'object-cover'}`}
                      style={turns ? { transform: `rotate(${turns * 90}deg)` } : undefined}
                    />
                  </div>
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
                  <div className="flex flex-col gap-2 text-xs">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="px-3 py-2 rounded-md border border-white/10 flex-1"
                        onClick={() => queueRotation(img.id, 'left')}
                      >
                        Rotate left
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-md border border-white/10 flex-1"
                        onClick={() => queueRotation(img.id, 'right')}
                      >
                        Rotate right
                      </button>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-2 rounded-md border border-brand-500/60"
                      disabled={!turns || savingThis}
                      onClick={() => saveRotation(img.id)}
                    >
                      {savingThis ? 'Saving...' : 'Save rotation'}
                    </button>
                    {turns !== 0 && <p className="text-[11px] text-amber-300">Rotation pending - save to apply.</p>}
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
