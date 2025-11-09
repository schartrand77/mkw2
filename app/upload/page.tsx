"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [material, setMaterial] = useState('PLA')
  const [modelFiles, setModelFiles] = useState<FileList | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modelFiles || modelFiles.length === 0) return alert('Please select one or more 3D model files (STL/OBJ/ZIP).')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('title', title)
      fd.append('description', description)
      fd.append('material', material)
      fd.append('tags', tags)
      // Multiple files supported (and ZIP)
      Array.from(modelFiles).forEach((f) => fd.append('files', f))
      if (imageFile) fd.append('image', imageFile)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      router.push(`/models/${data.model.id}`)
    } catch (err: any) {
      alert(err.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Upload a Model</h1>
      <form onSubmit={submit} className="space-y-4 glass p-6 rounded-xl">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Tags (comma separated)</label>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g., gadget, mount, cosplay" />
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
            <option>Resin</option>
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
