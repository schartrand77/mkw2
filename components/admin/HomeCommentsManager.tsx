"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type HomeComment = {
  id: string
  modelId: string
  modelTitle: string
  modelVisibility: string
  body: string
  type: string
  createdAt: string
  isHomeCurated: boolean
  user: {
    id: string | null
    displayName: string
    profileSlug: string | null
    avatarUrl: string | null
  }
}

type FilterMode = 'all' | 'curated' | 'uncurated'

export default function HomeCommentsManager() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<FilterMode>('all')
  const [comments, setComments] = useState<HomeComment[]>([])
  const [loading, setLoading] = useState(false)
  const [savingIds, setSavingIds] = useState<string[]>([])
  const [deletingIds, setDeletingIds] = useState<string[]>([])
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/home-comments?mode=${encodeURIComponent(mode)}&q=${encodeURIComponent(query)}`, {
          cache: 'no-store',
        })
        const payload = await res.json().catch(() => null)
        if (!active) return
        if (!res.ok) throw new Error(payload?.error || 'Failed to load comments')
        setComments(Array.isArray(payload?.comments) ? payload.comments : [])
      } catch (err: any) {
        if (!active) return
        setStatus({ type: 'error', message: err?.message || 'Failed to load comments' })
      } finally {
        if (active) setLoading(false)
      }
    }, 200)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [mode, query])

  const curatedCount = useMemo(() => comments.filter((comment) => comment.isHomeCurated).length, [comments])

  const markSaving = (id: string, active: boolean) => {
    setSavingIds((prev) => active ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((item) => item !== id))
  }

  const markDeleting = (id: string, active: boolean) => {
    setDeletingIds((prev) => active ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((item) => item !== id))
  }

  const toggleCurated = async (comment: HomeComment, next: boolean) => {
    markSaving(comment.id, true)
    setStatus(null)
    try {
      const res = await fetch(`/api/admin/home-comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHomeCurated: next }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'Failed to update curation')
      setComments((prev) => prev.map((item) => (item.id === comment.id ? { ...item, isHomeCurated: next } : item)))
      setStatus({ type: 'success', message: next ? 'Comment curated for home.' : 'Comment removed from home curation.' })
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Failed to update curation' })
    } finally {
      markSaving(comment.id, false)
    }
  }

  const deleteComment = async (comment: HomeComment) => {
    if (!window.confirm(`Delete this comment from ${comment.user.displayName}? This cannot be undone.`)) return
    markDeleting(comment.id, true)
    setStatus(null)
    try {
      const res = await fetch(`/api/admin/home-comments/${comment.id}`, { method: 'DELETE' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'Failed to delete comment')
      setComments((prev) => prev.filter((item) => item.id !== comment.id))
      setStatus({ type: 'success', message: 'Comment deleted.' })
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Failed to delete comment' })
    } finally {
      markDeleting(comment.id, false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Home comments</h2>
          <p className="text-sm text-slate-400">Curate comments shown on the home page and delete low-quality entries.</p>
        </div>
        <p className="text-sm text-slate-400">{curatedCount} curated in current view</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input flex-1"
          placeholder="Search by comment, model title, user name, or profile slug"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input w-full sm:w-44" value={mode} onChange={(e) => setMode(e.target.value as FilterMode)}>
          <option value="all">All comments</option>
          <option value="curated">Curated only</option>
          <option value="uncurated">Not curated</option>
        </select>
      </div>

      {status && (
        <p className={`text-sm ${status.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {status.message}
        </p>
      )}

      {loading && <p className="text-sm text-slate-400">Loading comments...</p>}
      {!loading && comments.length === 0 && <p className="text-sm text-slate-400">No comments found for this filter.</p>}

      <div className="space-y-3">
        {comments.map((comment) => {
          const isSaving = savingIds.includes(comment.id)
          const isDeleting = deletingIds.includes(comment.id)
          return (
            <article key={comment.id} className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {comment.user.avatarUrl ? (
                    <img
                      src={comment.user.avatarUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover border border-white/10"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full border border-white/10 bg-white/10 text-sm font-semibold flex items-center justify-center">
                      {(comment.user.displayName || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    {comment.user.profileSlug ? (
                      <Link href={`/u/${comment.user.profileSlug}`} className="block text-sm font-semibold truncate hover:underline">
                        {comment.user.displayName}
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold truncate">{comment.user.displayName}</p>
                    )}
                    <p className="text-xs text-slate-400">
                      on <Link href={`/models/${comment.modelId}`} className="hover:text-white">{comment.modelTitle}</Link>
                      {comment.modelVisibility !== 'public' ? ` (${comment.modelVisibility})` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-500">{new Date(comment.createdAt).toLocaleString()}</div>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{comment.body}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleCurated(comment, !comment.isHomeCurated)}
                  disabled={isSaving || isDeleting}
                  className={`px-3 py-1.5 rounded-md border text-xs ${
                    comment.isHomeCurated
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300/60'
                      : 'border-white/10 text-slate-200 hover:border-white/20'
                  } disabled:opacity-50`}
                >
                  {isSaving ? 'Saving...' : comment.isHomeCurated ? 'Remove from home' : 'Curate for home'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteComment(comment)}
                  disabled={isSaving || isDeleting}
                  className="px-3 py-1.5 rounded-md border border-rose-400/30 text-rose-200 hover:border-rose-300/60 text-xs disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete comment'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

