"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IMAGE_ACCEPT_ATTRIBUTE } from '@/lib/images'
import { MATERIAL_OPTIONS, normalizeMaterialName } from '@/lib/cartPricing'

async function notify(payload: { type: 'success' | 'error' | 'info'; title?: string; message: string }) {
  try {
    const mod = await import('@/components/notifications/NotificationsProvider')
    mod.pushSessionNotification(payload)
  } catch {}
}

function resolveUploadEndpoint(base?: string | null) {
  if (!base) return '/api/upload'
  const trimmed = base.trim().replace(/\s+$/, '')
  if (!trimmed) return '/api/upload'
  if (trimmed.toLowerCase().endsWith('/api/upload')) {
    return trimmed
  }
  return `${trimmed.replace(/\/+$/, '')}/api/upload`
}

export default function UploadForm({ directUploadUrl }: { directUploadUrl?: string | null }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creditName, setCreditName] = useState('')
  const [creditUrl, setCreditUrl] = useState('')
  const [material, setMaterial] = useState('PLA')
  const [modelFiles, setModelFiles] = useState<FileList | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()
  const uploadEndpoint = resolveUploadEndpoint(directUploadUrl)
  const isDirect = !!directUploadUrl

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modelFiles || modelFiles.length === 0) {
      setErrorMsg('Please select one or more 3D model files (STL/OBJ/3MF/ZIP).')
      return
    }
    setLoading(true)
    setProgressPct(0)
    try {
      setErrorMsg(null)
      const fd = new FormData()
      if (creditName) fd.append('creditName', creditName)
      if (creditUrl) fd.append('creditUrl', creditUrl)
      fd.append('title', title)
      fd.append('description', description)
      fd.append('material', material)
      fd.append('tags', tags)
      Array.from(modelFiles).forEach((f) => fd.append('files', f))
      if (imageFile) fd.append('image', imageFile)
      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', uploadEndpoint, true)
        if (isDirect) xhr.withCredentials = true
        xhr.responseType = 'json'
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return
          setProgressPct(Math.min(100, Math.round((event.loaded / event.total) * 100)))
        }
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response)
            return
          }
          const message = (xhr.response && xhr.response.error) ? xhr.response.error : 'Upload failed'
          reject(new Error(message))
        }
        xhr.send(fd)
      })
      await notify({ type: 'success', title: 'Upload complete', message: 'Your model is ready to view.' })
      router.push(`/models/${data.model.id}`)
    } catch (err: any) {
      setErrorMsg(err.message || 'Upload failed')
      await notify({ type: 'error', title: 'Upload failed', message: err.message || 'Upload failed' })
    } finally {
      setLoading(false)
      setProgressPct(0)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Upload a Model</h1>
      <form onSubmit={submit} className="space-y-4 glass p-6 rounded-xl">
        {errorMsg && <div className="text-amber-400 text-sm">{errorMsg}</div>}
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Tags (comma separated)</label>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g., gadget, mount, cosplay" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Credit model creator</label>
            <input className="input" value={creditName} onChange={(e) => setCreditName(e.target.value)} placeholder="Creator name" />
          </div>
          <div>
            <label className="block text-sm mb-1">Credit URL</label>
            <input className="input" type="url" value={creditUrl} onChange={(e) => setCreditUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Description</label>
          <textarea className="input h-24" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Material</label>
          <select
            className="input"
            value={normalizeMaterialName(material)}
            onChange={(e) => setMaterial(e.target.value)}
          >
            {MATERIAL_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Model files (.stl, .obj, .3mf, or .zip)</label>
          <input type="file" multiple accept=".stl,.obj,.3mf,.zip" onChange={(e) => setModelFiles(e.target.files)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Cover image (optional)</label>
          <input type="file" accept={IMAGE_ACCEPT_ATTRIBUTE} onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
        </div>
        <button className="btn" disabled={loading}>{loading ? 'Uploading...' : 'Upload'}</button>
        {loading && (
          <div className="space-y-2">
            <div className="text-xs text-slate-400">Uploading... {progressPct}%</div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
        {isDirect && (
          <p className="text-xs text-slate-400">Uploads route through <code>{uploadEndpoint}</code> using your direct hostname.</p>
        )}
      </form>
    </div>
  )
}
