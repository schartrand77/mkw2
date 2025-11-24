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

function PaginationControls({
  page,
  totalPages,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: {
  page: number
  totalPages: number
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <button className="px-2 py-1 rounded-md border border-white/10 disabled:opacity-40" onClick={onFirst} disabled={page <= 1}>
        « First
      </button>
      <button className="px-2 py-1 rounded-md border border-white/10 disabled:opacity-40" onClick={onPrev} disabled={page <= 1}>
        ‹ Prev
      </button>
      <div className="px-2 py-1 rounded-md border border-white/10 text-slate-300">
        Page {page} / {totalPages}
      </div>
      <button className="px-2 py-1 rounded-md border border-white/10 disabled:opacity-40" onClick={onNext} disabled={page >= totalPages}>
        Next ›
      </button>
      <button className="px-2 py-1 rounded-md border border-white/10 disabled:opacity-40" onClick={onLast} disabled={page >= totalPages}>
        Last »
      </button>
    </div>
  )
}

export default function ModelManager() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Model[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(12)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

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

  useEffect(() => {
    if (activeId && !items.find((m) => m.id === activeId)) setActiveId(null)
  }, [items, activeId])

  const updateModel = (id: string, patch: Partial<Model>) => {
    setItems(prev => prev.map((m) => m.id === id ? { ...m, ...patch } : m))
  }

  const saveRow = async (m: Model) => {
    setSavingId(m.id)
    try {
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
    } finally {
      setSavingId((current) => current === m.id ? null : current)
    }
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
      if (activeId === id) setActiveId(null)
    } catch (err: any) {
      console.error('Failed to delete model', err)
      alert(err?.message || 'Failed to delete model')
    } finally {
      setDeletingId((current) => (current === id ? null : current))
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const activeModel = activeId ? items.find((m) => m.id === activeId) || null : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Model manager</h2>
          <p className="text-sm text-slate-400">Find a model, then open it to edit details.</p>
        </div>
        {activeModel && (
          <button className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-sm" onClick={() => setActiveId(null)}>
            Back to list
          </button>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input className="input flex-1" placeholder="Search models..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} />
        <label className="text-sm text-slate-400 flex items-center gap-2">
          Page size
          <select
            className="input w-28"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
          >
            {[12, 24, 36, 48].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>
      {loading && <div className="text-slate-400 text-sm">Loading...</div>}

      {!activeModel && (
        <>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Results</div>
              {totalPages > 1 && (
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  onFirst={() => setPage(1)}
                  onPrev={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                  onLast={() => setPage(totalPages)}
                />
              )}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="flex items-start gap-3 p-3 rounded-lg border border-white/10 hover:border-white/20 bg-slate-900/40 text-left transition-colors"
                  onClick={() => setActiveId(m.id)}
                >
                  {m.coverImagePath ? (
                    <img
                      src={buildImageSrc(m.coverImagePath, m.updatedAt) || `/files${m.coverImagePath}`}
                      className="w-16 h-12 object-cover rounded border border-white/10"
                    />
                  ) : (
                    <div className="w-16 h-12 bg-slate-900/60 rounded border border-white/10" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-sm">{m.title}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">{m.visibility}</div>
                    {m.tags?.length > 0 && <div className="text-xs text-slate-400 truncate">{m.tags.join(', ')}</div>}
                  </div>
                </button>
              ))}
              {!loading && items.length === 0 && (
                <div className="col-span-full text-slate-400 text-sm">No models found.</div>
              )}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center">
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  onFirst={() => setPage(1)}
                  onPrev={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                  onLast={() => setPage(totalPages)}
                />
              </div>
            )}
          </div>
        </>
      )}

      {activeModel && (
        <div className="glass rounded-xl border border-white/10 divide-y divide-white/10">
          <div className="p-3 grid md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-1">
              {activeModel.coverImagePath ? (
                <img src={buildImageSrc(activeModel.coverImagePath, activeModel.updatedAt) || `/files${activeModel.coverImagePath}`} className="w-16 h-12 object-cover rounded border border-white/10" />
              ) : (
                <div className="w-16 h-12 bg-slate-900/60 rounded border border-white/10" />
              )}
            </div>
            <div className="md:col-span-3 text-sm">
              <div className="font-semibold mb-1">{activeModel.title}</div>
              <div className="text-xs text-slate-400 break-all">{activeModel.id}</div>
            </div>
            <div className="md:col-span-2">
              <select className="input" value={activeModel.visibility} onChange={(e) => updateModel(activeModel.id, { visibility: e.target.value })}>
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
                value={activeModel.priceOverrideUsd ?? ''}
                onChange={(e) => updateModel(activeModel.id, { priceOverrideUsd: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="Leave blank for automatic estimate"
              />
            </div>
            <div className="md:col-span-3">
              <input className="input" value={activeModel.tags.join(', ')} onChange={(e) => updateModel(activeModel.id, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
            </div>
            <div className="md:col-span-1 flex flex-col gap-2">
              <button className="btn disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => saveRow(activeModel)} disabled={savingId === activeModel.id}>
                {savingId === activeModel.id ? 'Saving...' : 'Save'}
              </button>
              <button
                className="btn bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => deleteRow(activeModel.id)}
                disabled={deletingId === activeModel.id}
              >
                {deletingId === activeModel.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
            <div className="md:col-span-12 grid md:grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="Affiliate label e.g. Springs kit"
                value={activeModel.affiliateTitle || ''}
                onChange={(e) => updateModel(activeModel.id, { affiliateTitle: e.target.value })}
              />
              <input
                className="input"
                placeholder="Amazon.ca link (dp/ASIN)"
                value={activeModel.affiliateUrl || ''}
                onChange={(e) => updateModel(activeModel.id, { affiliateUrl: e.target.value })}
              />
              <input
                className="input md:col-span-2"
                placeholder="YouTube URL or video ID"
                value={activeModel.videoUrl || ''}
                onChange={(e) => updateModel(activeModel.id, { videoUrl: e.target.value })}
              />
              <Link href={`/admin/models/${activeModel.id}/images`} className="px-3 py-2 rounded-md border border-white/10 text-center text-sm hover:border-white/20 md:col-span-2">
                Manage images
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
