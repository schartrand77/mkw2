"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IMAGE_ACCEPT_ATTRIBUTE } from '@/lib/images'
import { MATERIAL_OPTIONS, normalizeMaterialName } from '@/lib/cartPricing'

type Model = { id: string; title: string; description?: string | null; material?: string | null; coverImagePath?: string | null }

export default function ModelEditForm({ model }: { model: Model }) {
  const [title, setTitle] = useState(model.title)
  const [description, setDescription] = useState(model.description || '')
  const [material, setMaterial] = useState(model.material || 'PLA')
  const normalizedMaterial = normalizeMaterialName(material)
  const materialOptions = (() => {
    const options = MATERIAL_OPTIONS.map((option) => String(option))
    if (!options.includes(normalizedMaterial)) options.push(normalizedMaterial)
    return options
  })()
  const [cover, setCover] = useState<File | null>(null)
  const [removeCover, setRemoveCover] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('title', title)
      fd.append('description', description)
      fd.append('material', material)
      fd.append('removeCover', removeCover ? '1' : '0')
      if (cover) fd.append('cover', cover)
      const res = await fetch(`/api/models/${model.id}`, { method: 'PATCH', body: fd })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save')
      router.push(`/models/${model.id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass p-6 rounded-xl space-y-4">
      {error && <div className="text-amber-400 text-sm">{error}</div>}
      <div>
        <label className="block text-sm mb-1">Title</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm mb-1">Description</label>
        <textarea className="input h-40" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm mb-1">Material</label>
        <select
          className="input"
          value={normalizedMaterial}
          onChange={(e) => setMaterial(e.target.value)}
        >
          {materialOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">Cover image</label>
          <input type="file" accept={IMAGE_ACCEPT_ATTRIBUTE} onChange={(e) => setCover(e.target.files?.[0] || null)} />
        </div>
        <div className="flex items-center gap-2">
          <input id="rm" type="checkbox" checked={removeCover} onChange={(e) => setRemoveCover(e.target.checked)} />
          <label htmlFor="rm" className="text-sm">Remove existing cover</label>
        </div>
      </div>
      <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
    </form>
  )
}
