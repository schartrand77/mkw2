"use client"
import { useEffect, useMemo, useState } from 'react'
import { buildImageSrc } from '@/lib/public-path'

type Model = {
  id: string
  title: string
  coverImagePath?: string | null
  visibility?: string | null
  updatedAt?: string | null
}

const FEATURE_LIMIT = 24

export default function FeaturedManager({ initial }: { initial: Model[] }) {
  const [featured, setFeatured] = useState<Model[]>(dedupe(initial))
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Model[]>([])
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const ids = useMemo(() => new Set(featured.map((m) => m.id)), [featured])
  const atLimit = featured.length >= FEATURE_LIMIT

  useEffect(() => {
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
    } else {
      timeout = setTimeout(async () => {
        try {
          const res = await fetch(`/api/admin/search-models?q=${encodeURIComponent(trimmed)}`)
          if (!res.ok) return
          const data = await res.json()
          if (!cancelled) setResults(data.models)
        } catch {
          if (!cancelled) setResults([])
        }
      }, 250)
    }
    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
    }
  }, [query])

  const add = (model: Model) => {
    setFeatured((prev) => {
      if (prev.length >= FEATURE_LIMIT) return prev
      if (prev.some((m) => m.id === model.id)) return prev
      return [...prev, model]
    })
  }

  const remove = (id: string) => {
    setFeatured((prev) => prev.filter((m) => m.id !== id))
  }

  const move = (index: number, dir: -1 | 1) => {
    setFeatured((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return next
    })
  }

  const clearList = () => {
    setFeatured([])
  }

  const save = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/featured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelIds: featured.map((m) => m.id) }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || 'Failed to save featured list')
      setFeatured(dedupe(payload?.featured || []))
      setStatus({ type: 'success', message: 'Featured list updated' })
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Failed to save featured list' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Featured models</h2>
          <p className="text-sm text-slate-400">Pick the models you want highlighted on the home page spotlight.</p>
        </div>
        <div className="text-sm text-slate-400">{featured.length} / {FEATURE_LIMIT}</div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="input flex-1"
          placeholder="Search library to add"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="px-3 py-2 rounded-md border border-white/10 text-sm hover:border-white/20 disabled:opacity-40"
          onClick={clearList}
          disabled={featured.length === 0}
        >
          Clear featured
        </button>
      </div>
      {status && (
        <div className={`text-sm ${status.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
          {status.message}
        </div>
      )}

      {query.trim() && (
        <div className="glass rounded-xl p-3 border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Search results</span>
            {atLimit && <span>Limit reached</span>}
          </div>
          {results.length === 0 ? (
            <div className="text-sm text-slate-400">No models match that search.</div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {results.map((model) => {
                      const thumb = buildImageSrc(model.coverImagePath, model.updatedAt)
                      const alreadyAdded = ids.has(model.id)
                      return (
                        <button
                    key={model.id}
                    type="button"
                    onClick={() => add(model)}
                    disabled={alreadyAdded || atLimit}
                    className={`text-left glass rounded-lg overflow-hidden border border-white/10 hover:border-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {thumb ? (
                      <img src={thumb} className="aspect-video w-full object-cover" alt={model.title} />
                    ) : (
                      <div className="aspect-video w-full bg-slate-900/60" />
                    )}
                    <div className="p-3 space-y-1">
                      <div className="text-sm font-medium truncate">{model.title}</div>
                      <VisibilityBadge visibility={model.visibility} />
                      <div className="text-xs text-slate-400">
                        {alreadyAdded ? 'Already featured' : 'Add to featured'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="glass rounded-xl p-3 border border-white/10">
        <div className="text-xs text-slate-400 mb-2">Current featured order (top shows first on home)</div>
        {featured.length === 0 && <div className="text-sm text-slate-400">No featured models selected.</div>}
        <ul className="divide-y divide-white/10">
          {featured.map((model, index) => {
            const thumb = buildImageSrc(model.coverImagePath, model.updatedAt)
            return (
              <li key={model.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="w-6 text-xs text-slate-500">{index + 1}.</div>
                {thumb ? (
                  <img src={thumb} className="w-16 h-12 object-cover rounded border border-white/10" alt={model.title} />
                ) : (
                  <div className="w-16 h-12 bg-slate-900/60 rounded border border-white/10" />
                )}
                <div className="flex-1 min-w-[140px]">
                  <div className="text-sm font-medium">{model.title}</div>
                  <VisibilityBadge visibility={model.visibility} />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-2 py-1 rounded-md border border-white/10 text-xs hover:border-white/20 disabled:opacity-30"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded-md border border-white/10 text-xs hover:border-white/20 disabled:opacity-30"
                    onClick={() => move(index, 1)}
                    disabled={index === featured.length - 1}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded-md border border-white/10 text-xs hover:border-white/20"
                    onClick={() => remove(model.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-slate-500 mt-3">Only public models will be shown on the home page.</p>
      </div>

      <button className="btn" onClick={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save Featured'}
      </button>
    </div>
  )
}

function VisibilityBadge({ visibility }: { visibility?: string | null }) {
  if (!visibility || visibility === 'public') {
    return <span className="text-xs text-green-400">public</span>
  }
  const label = visibility === 'private' ? 'private' : 'unlisted'
  return (
    <span className="text-xs text-orange-300">
      {label} - hidden from home
    </span>
  )
}

function dedupe(list: Model[] = []) {
  const seen = new Set<string>()
  const unique: Model[] = []
  for (const item of list) {
    if (!item?.id) continue
    if (seen.has(item.id)) continue
    seen.add(item.id)
    unique.push(item)
  }
  return unique.slice(0, FEATURE_LIMIT)
}
