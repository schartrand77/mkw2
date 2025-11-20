"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { buildImageSrc } from '@/lib/public-path'

type Model = {
  id: string
  title: string
  coverImagePath?: string | null
  updatedAt?: string | null
  visibility: string
  priceOverrideUsd?: number | null
  tags: string[]
  affiliateTitle?: string | null
  affiliateUrl?: string | null
  videoEmbedId?: string | null
  videoUrl?: string
}

export default function ModelManager() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Model[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/models?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`)
        if (!res.ok) return
        const data = await res.json()
        if (active) {
          const normalized = data.models.map((m: Model) => ({
            ...m,
            videoUrl: m.videoEmbedId ? `https://youtu.be/${m.videoEmbedId}` : ''
          }))
          setItems(normalized)
          setTotal(data.total)
          setPage(data.page)
          setPageSize(data.pageSize)
        }
      } finally { setLoading(false) }
    }
    const t = setTimeout(run, 250)
    return () => { active = false; clearTimeout(t) }
  }, [query, page, pageSize])

  const updateRow = (i: number, patch: Partial<Model>) => {
    setItems(prev => prev.map((m, idx) => idx === i ? { ...m, ...patch } : m))
  }

  const saveRow = async (m: Model) => {
    const res = await fetch(`/api/admin/models/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility: m.visibility,
          tags: m.tags.join(','),
          affiliateTitle: m.affiliateTitle ?? '',
          affiliateUrl: m.affiliateUrl ?? '',
          videoUrl: m.videoUrl ?? '',
          priceOverrideUsd: m.priceOverrideUsd,
        })
      })
    if (!res.ok) alert('Failed to save model: ' + (await res.text()))
  }

  const deleteRow = async (id: string) => {
    const target = items.find((m) => m.id === id)
    const title = target?.title || 'this model'
    if (!confirm(`Permanently delete "${title}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/models/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Failed to delete model')
      }
      setItems((prev) => prev.filter((m) => m.id !== id))
      setTotal((prev) => Math.max(0, prev - 1))
    } catch (err: any) {
      console.error('Failed to delete model', err)
      alert(err?.message || 'Failed to delete model')
    } finally {
      setDeletingId((current) => (current === id ? null : current))
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Model manager</h2>
      <input className="input" placeholder="Search models…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} />
      {loading && <div className="text-slate-400 text-sm">Loading…</div>}
      <div className="glass rounded-xl border border-white/10 divide-y divide-white/10">
        {items.map((m, i) => (
          <div key={m.id} className="p-3 grid md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-1">
              {m.coverImagePath ? (
                <img src={buildImageSrc(m.coverImagePath, m.updatedAt) || `/files${m.coverImagePath}`} className="w-16 h-12 object-cover rounded border border-white/10" />
              ) : (
                <div className="w-16 h-12 bg-slate-900/60 rounded border border-white/10" />
              )}
            </div>
            <div className="md:col-span-3 text-sm">{m.title}</div>
            <div className="md:col-span-2">
              <select className="input" value={m.visibility} onChange={(e) => updateRow(i, { visibility: e.target.value })}>
                <option value="public">public</option>
                <option value="unlisted">unlisted</option>
                <option value="private">private</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Price override (manual)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={m.priceOverrideUsd ?? ''}
                onChange={(e) => updateRow(i, { priceOverrideUsd: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="Leave blank for automatic estimate"
              />
            </div>
            <div className="md:col-span-3">
              <input className="input" value={m.tags.join(', ')} onChange={(e) => updateRow(i, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
            </div>
            <div className="md:col-span-1 flex flex-col gap-2">
              <button className="btn" onClick={() => saveRow(m)}>Save</button>
              <button
                className="btn bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => deleteRow(m.id)}
                disabled={deletingId === m.id}
              >
                {deletingId === m.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
            <div className="md:col-span-12 grid md:grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="Affiliate label e.g. Springs kit"
                value={m.affiliateTitle || ''}
                onChange={(e) => updateRow(i, { affiliateTitle: e.target.value })}
              />
              <input
                className="input"
                placeholder="Amazon.ca link (dp/ASIN)"
                value={m.affiliateUrl || ''}
                onChange={(e) => updateRow(i, { affiliateUrl: e.target.value })}
              />
              <input
                className="input md:col-span-2"
                placeholder="YouTube URL or video ID"
                value={m.videoUrl || ''}
                onChange={(e) => updateRow(i, { videoUrl: e.target.value })}
              />
              <Link href={`/admin/models/${m.id}/images`} className="px-3 py-2 rounded-md border border-white/10 text-center text-sm hover:border-white/20 md:col-span-2">
                Manage images
              </Link>
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md border border-white/10" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <div className="text-sm text-slate-400">Page {page} / {totalPages}</div>
          <button className="px-3 py-1.5 rounded-md border border-white/10" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
