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

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let idx = 0
  let size = value
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024
    idx += 1
  }
  const precision = idx === 0 ? 0 : 1
  return `${size.toFixed(precision)} ${units[idx]}`
}

export default function UploadForm({
  directUploadUrl,
  maxFileBytes,
  maxTotalBytes,
}: {
  directUploadUrl?: string | null
  maxFileBytes: number | null
  maxTotalBytes: number | null
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creditName, setCreditName] = useState('')
  const [creditUrl, setCreditUrl] = useState('')
  const [material, setMaterial] = useState('PLA')
  const [sizeXmm, setSizeXmm] = useState('')
  const [sizeYmm, setSizeYmm] = useState('')
  const [sizeZmm, setSizeZmm] = useState('')
  const [modelFiles, setModelFiles] = useState<FileList | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [progressLoaded, setProgressLoaded] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
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
    const selectedFiles = Array.from(modelFiles)
    const oversizedFile = maxFileBytes == null ? null : selectedFiles.find((file) => (file?.size || 0) > maxFileBytes)
    if (oversizedFile) {
      setErrorMsg(`"${oversizedFile.name}" exceeds the per-file limit of ${formatBytes(maxFileBytes ?? 0)}.`)
      return
    }
    const selectedModelBytes = selectedFiles.reduce((sum, file) => sum + (file?.size || 0), 0)
    if (maxTotalBytes != null && selectedModelBytes > maxTotalBytes) {
      setErrorMsg(`Selected model files exceed the total upload limit of ${formatBytes(maxTotalBytes)}.`)
      return
    }
    setLoading(true)
    setProgressPct(0)
    setProgressLoaded(0)
    const totalSize =
      selectedModelBytes
      + (imageFile?.size || 0)
    setProgressTotal(totalSize)
    try {
      setErrorMsg(null)
      const fd = new FormData()
      if (creditName) fd.append('creditName', creditName)
      if (creditUrl) fd.append('creditUrl', creditUrl)
      fd.append('title', title)
      fd.append('description', description)
      fd.append('material', material)
      fd.append('tags', tags)
      if (sizeXmm) fd.append('sizeXmm', sizeXmm)
      if (sizeYmm) fd.append('sizeYmm', sizeYmm)
      if (sizeZmm) fd.append('sizeZmm', sizeZmm)
      selectedFiles.forEach((f) => fd.append('files', f))
      if (imageFile) fd.append('image', imageFile)
      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', uploadEndpoint, true)
        if (isDirect) xhr.withCredentials = true
        xhr.responseType = 'json'
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return
          setProgressLoaded(event.loaded)
          setProgressTotal(event.total)
          setProgressPct(Math.min(100, Math.round((event.loaded / event.total) * 100)))
        }
        xhr.onerror = () => reject(new Error(
          isDirect
            ? 'Upload failed before the server responded. Check the upload host and network path.'
            : 'Upload failed before the server responded. If you use Cloudflare or a tunnel, configure a Direct upload URL to bypass request size limits.',
        ))
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response)
            return
          }
          const responseError = xhr.response && typeof xhr.response === 'object' ? xhr.response.error : null
          const message =
            responseError
            || (xhr.status === 413 && maxFileBytes != null && maxTotalBytes != null
              ? `Upload too large. Limit is ${formatBytes(maxFileBytes)} per file and ${formatBytes(maxTotalBytes)} total.`
              : xhr.status === 413
                ? 'Upload rejected as too large by the server or proxy.'
              : xhr.status >= 500
                ? 'Upload failed on the server. Try again, and if this only happens for large files check any reverse proxy size limits.'
                : 'Upload failed')
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
      setProgressLoaded(0)
      setProgressTotal(0)
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
          <label className="block text-sm mb-1">Target size (mm, optional)</label>
          <div className="grid grid-cols-3 gap-2">
            <input
              className="input"
              type="number"
              min={0.1}
              step={0.1}
              value={sizeXmm}
              onChange={(e) => setSizeXmm(e.target.value)}
              placeholder="X"
            />
            <input
              className="input"
              type="number"
              min={0.1}
              step={0.1}
              value={sizeYmm}
              onChange={(e) => setSizeYmm(e.target.value)}
              placeholder="Y"
            />
            <input
              className="input"
              type="number"
              min={0.1}
              step={0.1}
              value={sizeZmm}
              onChange={(e) => setSizeZmm(e.target.value)}
              placeholder="Z"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Use this if the model needs scaling for estimates. Applies to single-file uploads.</p>
        </div>
        <div>
          <label className="block text-sm mb-1">Model files (.stl, .obj, .3mf, or .zip)</label>
          <input type="file" multiple accept=".stl,.obj,.3mf,.zip" onChange={(e) => setModelFiles(e.target.files)} />
          <p className="text-xs text-slate-400 mt-1">
            {maxFileBytes == null || maxTotalBytes == null
              ? 'LAN upload mode: no app-enforced size limit. Any remaining limit would come from the upload host, proxy, or available disk space.'
              : `Limit: ${formatBytes(maxFileBytes)} per file, ${formatBytes(maxTotalBytes)} total for model files.`}
          </p>
        </div>
        <div>
          <label className="block text-sm mb-1">Cover image (optional)</label>
          <input type="file" accept={IMAGE_ACCEPT_ATTRIBUTE} onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
        </div>
        <button className="btn" disabled={loading}>{loading ? 'Uploading...' : 'Upload'}</button>
        {loading && (
          <div className="space-y-2">
            <div className="text-xs text-slate-400">
              Uploading... {progressPct}% ({formatBytes(progressLoaded)} / {formatBytes(progressTotal)})
            </div>
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
