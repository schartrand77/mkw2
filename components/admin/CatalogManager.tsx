"use client"

import { useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import { buildImageSrc } from '@/lib/public-path'

type CatalogLabels = {
  productsModelsLabel?: string | null
  productsMerchLabel?: string | null
}

type MerchItem = {
  id: string
  title: string
  description?: string | null
  category: string
  availability: 'in_stock' | 'back_ordered'
  priceUsd?: number | null
  imageUrl?: string | null
  galleryImageUrls?: string[] | null
  externalUrl?: string | null
  ctaLabel?: string | null
  sizeOptions?: string[] | null
  colorOptions?: string[] | null
  isActive: boolean
  sortOrder: number
  updatedAt?: string | null
}

type Props = {
  initialLabels: CatalogLabels
  initialMerch: MerchItem[]
}

type MerchDraft = Omit<MerchItem, 'id'>

const emptyDraft = (): MerchDraft => ({
  title: '',
  description: '',
  category: 'Merch',
  availability: 'in_stock',
  priceUsd: null,
  imageUrl: '',
  galleryImageUrls: [],
  externalUrl: '',
  ctaLabel: '',
  isActive: true,
  sortOrder: 0,
  updatedAt: null,
})

export default function CatalogManager({ initialLabels, initialMerch }: Props) {
  const [labels, setLabels] = useState<CatalogLabels>(initialLabels)
  const [items, setItems] = useState<MerchItem[]>(initialMerch)
  const [draft, setDraft] = useState<MerchDraft>(emptyDraft())
  const [savingLabels, setSavingLabels] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)

  const normalizeGalleryImages = (values?: (string | null | undefined)[] | null) => {
    if (!Array.isArray(values)) return []
    const output: string[] = []
    const seen = new Set<string>()
    for (const entry of values) {
      const value = String(entry || '').trim()
      if (!value || seen.has(value)) continue
      seen.add(value)
      output.push(value)
    }
    return output.slice(0, 24)
  }

  const categoryPreview = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      if (!item.isActive) continue
      const key = (item.category || 'Merch').trim() || 'Merch'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }))
  }, [items])

  const saveLabels = async () => {
    setSavingLabels(true)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        productsModelsLabel: labels.productsModelsLabel?.trim() || null,
        productsMerchLabel: labels.productsMerchLabel?.trim() || null,
      }
      const res = await fetch('/api/admin/catalog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to save catalog labels.')
      setLabels(data.config || payload)
      setMessage('Saved catalog labels.')
    } catch (err: any) {
      setError(err?.message || 'Failed to save catalog labels.')
    } finally {
      setSavingLabels(false)
    }
  }

  const startEdit = (item: MerchItem) => {
    setEditingId(item.id)
    setDraft({
      title: item.title,
      description: item.description || '',
      category: item.category || 'Merch',
      availability: item.availability || 'in_stock',
      priceUsd: item.priceUsd ?? null,
      imageUrl: item.imageUrl || '',
      galleryImageUrls: normalizeGalleryImages([...(Array.isArray(item.galleryImageUrls) ? item.galleryImageUrls : []), item.imageUrl || null]),
      externalUrl: item.externalUrl || '',
      ctaLabel: item.ctaLabel || '',
      sizeOptions: Array.isArray(item.sizeOptions) ? item.sizeOptions : null,
      colorOptions: Array.isArray(item.colorOptions) ? item.colorOptions : null,
      isActive: item.isActive,
      sortOrder: item.sortOrder ?? 0,
      updatedAt: item.updatedAt || null,
    })
    setImageFiles([])
    setMessage(null)
    setError(null)
  }

  const resetEditor = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setImageFiles([])
  }

  const uploadImages = async (files: File[]) => {
    if (!files.length) return []
    setUploadingImage(true)
    try {
      const uploaded: string[] = []
      for (const file of files) {
        const form = new FormData()
        form.set('image', file)
        const res = await fetch('/api/admin/merch/image', { method: 'POST', body: form })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Failed to upload image.')
        const nextImageUrl = String(data?.imageUrl || '').trim()
        if (!nextImageUrl) throw new Error('Image upload did not return a path.')
        uploaded.push(nextImageUrl)
      }
      setImageFiles([])
      return uploaded
    } finally {
      setUploadingImage(false)
    }
  }

  const saveItem = async () => {
    if (!draft.title.trim()) {
      setError('Merch title is required.')
      return
    }
    setSavingItem(true)
    setError(null)
    setMessage(null)
    try {
      const uploadedImages = await uploadImages(imageFiles)
      const galleryImageUrls = normalizeGalleryImages([...(draft.galleryImageUrls || []), ...uploadedImages])
      const hostedImageUrl = String(draft.imageUrl || '').trim() || galleryImageUrls[0] || null
      const payload = {
        title: draft.title.trim(),
        description: draft.description?.trim() || null,
        category: draft.category?.trim() || 'Merch',
        availability: draft.availability || 'in_stock',
        priceUsd: draft.priceUsd != null && Number.isFinite(Number(draft.priceUsd)) ? Number(draft.priceUsd) : null,
        imageUrl: hostedImageUrl,
        galleryImageUrls,
        externalUrl: draft.externalUrl?.trim() || null,
        ctaLabel: draft.ctaLabel?.trim() || null,
        sizeOptions: Array.isArray(draft.sizeOptions)
          ? draft.sizeOptions.map((entry) => String(entry || '').trim()).filter(Boolean)
          : null,
        colorOptions: Array.isArray(draft.colorOptions)
          ? draft.colorOptions.map((entry) => String(entry || '').trim()).filter(Boolean)
          : null,
        isActive: Boolean(draft.isActive),
        sortOrder: Math.max(0, Math.round(Number(draft.sortOrder) || 0)),
      }
      const endpoint = editingId ? `/api/admin/merch/${editingId}` : '/api/admin/merch'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to save merch item.')
      const saved = data.item as MerchItem
      setItems((prev) => {
        const exists = prev.some((item) => item.id === saved.id)
        const next = exists ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev]
        return [...next].sort((a, b) => (a.sortOrder - b.sortOrder) || a.title.localeCompare(b.title))
      })
      resetEditor()
      const notifyResult = data?.notifyResult as { pending: number; sent: number; failed: number } | undefined
      const notifyWarning = typeof data?.notifyWarning === 'string' ? data.notifyWarning : null
      const stockworksWarning = typeof data?.stockworksWarning === 'string' ? data.stockworksWarning : null
      if (notifyResult && (notifyResult.sent > 0 || notifyResult.failed > 0 || notifyResult.pending > 0)) {
        const parts = ['Updated merch item.']
        parts.push(`Availability emails: ${notifyResult.sent} sent`)
        if (notifyResult.failed > 0) parts.push(`${notifyResult.failed} failed`)
        if (notifyWarning) parts.push(notifyWarning)
        if (stockworksWarning) parts.push(`StockWorks: ${stockworksWarning}`)
        setMessage(parts.join(' '))
      } else {
        const base = editingId ? 'Updated merch item.' : 'Added merch item.'
        setMessage(stockworksWarning ? `${base} StockWorks: ${stockworksWarning}` : base)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save merch item.')
    } finally {
      setSavingItem(false)
    }
  }

  const removeItem = async (id: string) => {
    if (!confirm('Delete this merch item?')) return
    setSavingItem(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/merch/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Delete failed.')
      setItems((prev) => prev.filter((item) => item.id !== id))
      if (editingId === id) resetEditor()
      setMessage('Deleted merch item.')
    } catch (err: any) {
      setError(err?.message || 'Delete failed.')
    } finally {
      setSavingItem(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{message}</div>}

      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
        <h2 className="text-lg font-semibold">Catalog Labels</h2>
        <p className="text-xs text-slate-400">Customize storefront section labels for this business install.</p>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-slate-400">Models label</span>
            <input
              className="input"
              value={labels.productsModelsLabel || ''}
              placeholder="Models"
              onChange={(e) => setLabels((prev) => ({ ...prev, productsModelsLabel: e.target.value }))}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-400">Merch label</span>
            <input
              className="input"
              value={labels.productsMerchLabel || ''}
              placeholder="Merch"
              onChange={(e) => setLabels((prev) => ({ ...prev, productsMerchLabel: e.target.value }))}
            />
          </label>
        </div>
        <button className="btn text-sm" onClick={saveLabels} disabled={savingLabels}>
          {savingLabels ? 'Saving labels...' : 'Save labels'}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{editingId ? 'Edit merch item' : 'Add merch item'}</h2>
            <p className="text-xs text-slate-400">Create custom merch for your own shop workflow.</p>
          </div>
          {editingId && (
            <button className="text-xs px-2 py-1 rounded border border-white/10 hover:border-white/30" onClick={resetEditor}>
              Cancel edit
            </button>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-slate-400">Title</span>
            <input className="input" value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-400">Category</span>
            <input className="input" value={draft.category} onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))} placeholder="Apparel, Accessories, etc." />
          </label>
          <label className="text-sm space-y-1 md:col-span-2">
            <span className="text-slate-400">Description</span>
            <textarea className="input min-h-[90px]" value={draft.description || ''} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-400">Price (USD)</span>
            <input className="input" type="number" min={0} step={0.01} value={draft.priceUsd ?? ''} onChange={(e) => setDraft((prev) => ({ ...prev, priceUsd: e.target.value === '' ? null : Number(e.target.value) }))} />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-400">Availability</span>
            <select className="input" value={draft.availability} onChange={(e) => setDraft((prev) => ({ ...prev, availability: e.target.value as 'in_stock' | 'back_ordered' }))}>
              <option value="in_stock">In stock</option>
              <option value="back_ordered">Back ordered</option>
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-400">Sort order</span>
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              value={draft.sortOrder}
              onChange={(e) => {
                const next = Math.max(0, Math.round(Number(e.target.value) || 0))
                setDraft((prev) => ({ ...prev, sortOrder: next }))
              }}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-400">Image upload</span>
            <input
              className="input"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
            />
            <div className="text-xs text-slate-500">Self-hosted in app storage. Choose multiple photos for gallery.</div>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-400">External URL</span>
            <input className="input" type="url" value={draft.externalUrl || ''} onChange={(e) => setDraft((prev) => ({ ...prev, externalUrl: e.target.value }))} />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-400">CTA label</span>
            <input className="input" value={draft.ctaLabel || ''} onChange={(e) => setDraft((prev) => ({ ...prev, ctaLabel: e.target.value }))} placeholder="Shop now" />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-400">Sizes (comma-separated)</span>
            <input
              className="input"
              value={Array.isArray(draft.sizeOptions) ? draft.sizeOptions.join(', ') : ''}
              onChange={(e) => setDraft((prev) => ({
                ...prev,
                sizeOptions: e.target.value.trim()
                  ? Array.from(new Set(e.target.value.split(',').map((entry) => entry.trim()).filter(Boolean)))
                  : null,
              }))}
              placeholder="XS, S, M, L, XL"
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-400">Colors (comma-separated)</span>
            <input
              className="input"
              value={Array.isArray(draft.colorOptions) ? draft.colorOptions.join(', ') : ''}
              onChange={(e) => setDraft((prev) => ({
                ...prev,
                colorOptions: e.target.value.trim()
                  ? Array.from(new Set(e.target.value.split(',').map((entry) => entry.trim()).filter(Boolean)))
                  : null,
              }))}
              placeholder="Black, White, Navy"
            />
          </label>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((prev) => ({ ...prev, isActive: e.target.checked }))} />
            <span>Visible on products page</span>
          </label>
          <div className="md:col-span-2 text-xs text-slate-400">
            Cover image path: {draft.imageUrl?.trim() || 'No image selected'}
          </div>
          {(imageFiles.length > 0 || (draft.galleryImageUrls && draft.galleryImageUrls.length > 0) || draft.imageUrl) && (
            <div className="md:col-span-2 space-y-2">
              {imageFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {imageFiles.map((file) => (
                    <span key={file.name} className="rounded border border-white/10 px-2 py-1 text-xs text-slate-300">
                      Pending upload: {file.name}
                    </span>
                  ))}
                </div>
              )}
              {(draft.galleryImageUrls && draft.galleryImageUrls.length > 0) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {draft.galleryImageUrls.map((image, idx) => (
                    <div key={`${image}-${idx}`} className="rounded border border-white/10 p-1 bg-black/20 space-y-1">
                      <img src={buildImageSrc(image, draft.updatedAt || null) || image} alt={`Gallery ${idx + 1}`} className="h-20 w-full rounded object-cover" />
                      <div className="flex gap-1">
                        {idx !== 0 && (
                          <button
                            type="button"
                            className="text-[10px] px-2 py-1 rounded border border-white/10 hover:border-white/30"
                            onClick={() => setDraft((prev) => {
                              const list = normalizeGalleryImages(prev.galleryImageUrls)
                              const next = [list[idx], ...list.filter((_, i) => i !== idx)]
                              return { ...prev, galleryImageUrls: next, imageUrl: next[0] || '' }
                            })}
                          >
                            Set cover
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-[10px] px-2 py-1 rounded border border-rose-500/40 text-rose-200 hover:border-rose-400/70"
                          onClick={() => setDraft((prev) => {
                            const list = normalizeGalleryImages(prev.galleryImageUrls).filter((_, i) => i !== idx)
                            return { ...prev, galleryImageUrls: list, imageUrl: list[0] || '' }
                          })}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {draft.imageUrl && (
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border border-white/10 hover:border-white/30"
                  onClick={() => setDraft((prev) => ({ ...prev, imageUrl: '', galleryImageUrls: [] }))}
                >
                  Clear all gallery images
                </button>
              )}
            </div>
          )}
        </div>
        <button className="btn text-sm" onClick={saveItem} disabled={savingItem || uploadingImage}>
          {savingItem || uploadingImage ? 'Saving...' : (editingId ? 'Update merch item' : 'Add merch item')}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
        <h2 className="text-lg font-semibold">Merch Inventory</h2>
        {categoryPreview.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {categoryPreview.map((entry) => (
              <span key={entry.name} className="rounded-full border border-white/10 px-2 py-1 text-slate-300">
                {entry.name}: {entry.count}
              </span>
            ))}
          </div>
        )}
        {items.length === 0 ? (
          <div className="text-sm text-slate-500">No merch items yet.</div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-black/30 p-3 flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-semibold">{item.title}</div>
                  <div className="text-xs text-slate-400">{item.category} {item.isActive ? '' : '- hidden'}</div>
                  <div className="text-xs text-slate-400">Status: {item.availability === 'back_ordered' ? 'Back ordered' : 'In stock'}</div>
                  {(Array.isArray(item.galleryImageUrls) && item.galleryImageUrls.length > 0) ? (
                    <div className="flex gap-2">
                      {item.galleryImageUrls.slice(0, 3).map((image, idx) => (
                        <img
                          key={`${image}-${idx}`}
                          src={buildImageSrc(image, item.updatedAt || null) || image}
                          alt={`${item.title} ${idx + 1}`}
                          className="h-16 w-24 rounded border border-white/10 object-cover"
                        />
                      ))}
                    </div>
                  ) : item.imageUrl ? (
                    <img
                      src={buildImageSrc(item.imageUrl, item.updatedAt || null) || item.imageUrl}
                      alt={item.title}
                      className="h-16 w-24 rounded border border-white/10 object-cover"
                    />
                  ) : null}
                  {item.description && <div className="text-sm text-slate-300">{item.description}</div>}
                  {(Array.isArray(item.sizeOptions) && item.sizeOptions.length > 0) && (
                    <div className="text-xs text-slate-400">Sizes: {item.sizeOptions.join(', ')}</div>
                  )}
                  {(Array.isArray(item.colorOptions) && item.colorOptions.length > 0) && (
                    <div className="text-xs text-slate-400">Colors: {item.colorOptions.join(', ')}</div>
                  )}
                  <div className="text-xs text-slate-400">
                    {item.priceUsd != null ? formatCurrency(item.priceUsd) : 'No price'} - Sort {item.sortOrder}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="text-xs px-2 py-1 rounded border border-white/10 hover:border-white/30" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button className="text-xs px-2 py-1 rounded border border-rose-500/40 text-rose-200 hover:border-rose-400/70" onClick={() => removeItem(item.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
