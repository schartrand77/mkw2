"use client"
import { useCallback, useEffect, useState } from 'react'
import { IMAGE_ACCEPT_ATTRIBUTE } from '@/lib/images'

type ModelImage = { id: string; filePath: string; caption: string | null }

export default function ModelImagesManager({ modelId, initialCover }: { modelId: string; initialCover?: string | null }) {
  const [images, setImages] = useState<ModelImage[]>([])
  const [coverPath, setCoverPath] = useState<string | null>(initialCover || null)
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({})
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [setCover, setSetCover] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/models/${modelId}/images`)
    if (!res.ok) throw new Error('Failed to load images')
    const data = await res.json()
    setImages(data.images)
    setCoverPath(data.coverImagePath || null)
    const drafts: Record<string, string> = {}
    data.images.forEach((img: ModelImage) => { drafts[img.id] = img.caption || '' })
    setCaptionDrafts(drafts)
  }, [modelId])

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
      const res = await fetch(`/api/admin/models/${modelId}/images`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await readErrorMessage(res))
      await load()
      resetForm()
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const updateCaption = async (id: string) => {
    const caption = captionDrafts[id] || ''
    const res = await fetch(`/api/admin/models/${modelId}/images/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    })
    if (!res.ok) {
      setError(await readErrorMessage(res))
      return
    }
    await load()
  }

  const setAsCover = async (id: string) => {
    const res = await fetch(`/api/admin/models/${modelId}/images/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setCover: true }),
    })
    if (!res.ok) {
      setError(await readErrorMessage(res))
      return
    }
    await load()
  }

  const remove = async (id: string) => {
    if (!confirm('Remove this image?')) return
    const res = await fetch(`/api/admin/models/${modelId}/images/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError(await readErrorMessage(res))
      return
    }
    await load()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={upload} className="glass p-4 rounded-xl space-y-3">
        <h2 className="text-lg font-semibold">Add image</h2>
        {error && <div className="text-amber-400 text-sm">{error}</div>}
        <input type="file" accept={IMAGE_ACCEPT_ATTRIBUTE} onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <input className="input" placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={setCover} onChange={(e) => setSetCover(e.target.checked)} />
          Use as cover thumbnail
        </label>
        <button className="btn" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Existing images</h2>
        {images.length === 0 && <p className="text-sm text-slate-400">No images uploaded yet.</p>}
        <div className="grid md:grid-cols-2 gap-4">
          {images.map((img) => (
            <div key={img.id} className="glass rounded-xl overflow-hidden border border-white/10">
              <img src={`/files${img.filePath.startsWith('/') ? img.filePath : `/${img.filePath}`}`} alt={img.caption || 'Model image'} className="w-full aspect-video object-cover" />
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
          ))}
        </div>
      </div>
    </div>
  )
}
