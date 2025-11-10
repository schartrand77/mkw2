"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creditName, setCreditName] = useState('')
  const [creditUrl, setCreditUrl] = useState('')
  const [material, setMaterial] = useState('PLA')
  const [modelFiles, setModelFiles] = useState<FileList | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modelFiles || modelFiles.length === 0) {
      setErrorMsg('Please select one or more 3D model files (STL/OBJ/ZIP).')
      return
    }
    setLoading(true)
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
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        try { const j = await res.json(); throw new Error(j.error || 'Upload failed') } catch { throw new Error('Upload failed') }
      }
      const data = await res.json()
      router.push(`/models/${data.model.id}`)
    } catch (err: any) {
      setErrorMsg(err.message || 'Upload failed')
      try { const { pushSessionNotification } = await import('../../components/notifications/NotificationsProvider'); pushSessionNotification({ type: 'error', title: 'Upload failed', message: err.message || 'Upload failed' }); } catch {}
    } finally {
      setLoading(false)
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
          <select className="input" value={material} onChange={(e) => setMaterial(e.target.value)}>
            <option>PLA</option>
            <option>ABS</option>
            <option>PETG</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Model files (.stl, .obj, or .zip)</label>
          <input type="file" multiple accept=".stl,.obj,.zip" onChange={(e) => setModelFiles(e.target.files)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Cover image (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
        </div>
        <button className="btn" disabled={loading}>{loading ? 'Uploading…' : 'Upload'}</button>
        <p className="text-xs text-slate-400">Sign in not required for demo; will attach to anonymous user.</p>
      </form>
    </div>
  )
}

