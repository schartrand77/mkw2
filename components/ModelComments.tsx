"use client"

import Link from 'next/link'
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useNotifications } from '@/components/notifications/NotificationsProvider'
import { IMAGE_ACCEPT_ATTRIBUTE } from '@/lib/images'

type CommentUser = {
  id?: string
  name?: string | null
  profileSlug: string | null
  displayName: string
  avatarUrl: string | null
}

export type Comment = {
  id: string
  body: string
  createdAt: string
  type: 'comment' | 'make'
  imageUrl: string | null
  imageWidth: number | null
  imageHeight: number | null
  isVerified: boolean
  partReview?: {
    partId: string
    partName: string
    pin?: {
      x: number
      y: number
      z: number
    } | null
  } | null
  user: CommentUser
}

type Props = {
  modelId: string
  initialComments: Comment[]
  currentUserId?: string | null
  canModerate?: boolean
}

export default function ModelComments({ modelId, initialComments = [], currentUserId, canModerate = false }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments || [])
  const [body, setBody] = useState('')
  const [commentType, setCommentType] = useState<Comment['type']>('comment')
  const [makeImage, setMakeImage] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<string[]>([])
  const [selectedPartReview, setSelectedPartReview] = useState<{ partId: string; partName: string; pin?: { x: number; y: number; z: number } | null } | null>(null)
  const [activePartFilter, setActivePartFilter] = useState<string>('all')
  const { notify } = useNotifications()

  const dateFormatter = useMemo(() => (
    typeof Intl !== 'undefined'
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : null
  ), [])

  const formatTimestamp = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return dateFormatter ? dateFormatter.format(date) : date.toLocaleString()
  }

  const makerGallery = useMemo(
    () => comments.filter((comment) => comment.type === 'make' && !!comment.imageUrl),
    [comments],
  )
  const reviewedParts = useMemo(() => {
    const parts = new Map<string, string>()
    comments.forEach((comment) => {
      if (comment.partReview?.partId && comment.partReview.partName) {
        parts.set(comment.partReview.partId, comment.partReview.partName)
      }
    })
    if (selectedPartReview?.partId && selectedPartReview.partName) {
      parts.set(selectedPartReview.partId, selectedPartReview.partName)
    }
    return Array.from(parts.entries()).map(([partId, partName]) => ({ partId, partName }))
  }, [comments, selectedPartReview])
  const visibleComments = useMemo(() => (
    activePartFilter === 'all'
      ? comments
      : comments.filter((comment) => comment.partReview?.partId === activePartFilter)
  ), [activePartFilter, comments])

  useEffect(() => {
    if (activePartFilter === 'all') return
    if (reviewedParts.some((entry) => entry.partId === activePartFilter)) return
    setActivePartFilter('all')
  }, [activePartFilter, reviewedParts])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePartSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ partId?: string; partName?: string; pin?: { x: number; y: number; z: number } | null }>).detail
      if (!detail?.partId || !detail.partName) {
        setSelectedPartReview(null)
        return
      }
      setSelectedPartReview({ partId: detail.partId, partName: detail.partName, pin: detail.pin || null })
      setActivePartFilter(detail.partId)
    }
    window.addEventListener('mwv2:model-part-selection', handlePartSelection as EventListener)
    return () => window.removeEventListener('mwv2:model-part-selection', handlePartSelection as EventListener)
  }, [])

  const handleTypeChange = (value: Comment['type']) => {
    setCommentType(value)
    setError(null)
    if (value !== 'make') {
      setMakeImage(null)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null
    setMakeImage(nextFile)
    setError(null)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = body.trim()
    if (trimmed.length < 2) {
      setError('Comment is too short.')
      return
    }
    if (trimmed.length > 1000) {
      setError('Comment is too long.')
      return
    }
    if (commentType === 'make' && !makeImage) {
      setError('Attach a photo of your make to post it.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('body', trimmed)
      formData.append('type', commentType)
      if (selectedPartReview?.partId && selectedPartReview.partName) {
        formData.append('partId', selectedPartReview.partId)
        formData.append('partName', selectedPartReview.partName)
        if (selectedPartReview.pin) {
          formData.append('pinX', String(selectedPartReview.pin.x))
          formData.append('pinY', String(selectedPartReview.pin.y))
          formData.append('pinZ', String(selectedPartReview.pin.z))
        }
      }
      if (commentType === 'make' && makeImage) {
        formData.append('image', makeImage)
      }
      const res = await fetch(`/api/models/${modelId}/comments`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to add comment')
      }
      if (data?.comment) {
        setComments(prev => [...prev, data.comment])
      }
      setBody('')
      setCommentType('comment')
      setMakeImage(null)
      setSelectedPartReview(null)
      notify({ type: 'success', title: 'Thanks!', message: 'Your comment is live.' })
    } catch (err: any) {
      const msg = err?.message || 'Failed to add comment'
      setError(msg)
      notify({ type: 'error', title: 'Comment failed', message: msg })
    } finally {
      setSubmitting(false)
    }
  }

  const deleteComment = async (commentId: string) => {
    if (!canModerate) return
    if (typeof window !== 'undefined' && !window.confirm('Delete this comment?')) {
      return
    }
    setDeletingIds(prev => prev.includes(commentId) ? prev : [...prev, commentId])
    try {
      const res = await fetch(`/api/models/${modelId}/comments/${commentId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to delete comment')
      }
      setComments(prev => prev.filter(c => c.id !== commentId))
      notify({ type: 'success', title: 'Comment removed', message: 'The comment has been deleted.' })
    } catch (err: any) {
      notify({ type: 'error', title: 'Delete failed', message: err?.message || 'Unable to delete comment.' })
    } finally {
      setDeletingIds(prev => prev.filter(id => id !== commentId))
    }
  }

  const isDeleting = (commentId: string) => deletingIds.includes(commentId)

  const renderAvatar = (comment: Comment) => {
    if (comment.user?.avatarUrl) {
      return (
        <img
          src={comment.user.avatarUrl}
          alt=""
          className="w-10 h-10 rounded-full object-cover border border-white/10"
          loading="lazy"
        />
      )
    }
    const letter = comment.user?.displayName?.[0]?.toUpperCase() || '?'
    return (
      <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center text-sm font-semibold border border-white/10">
        {letter}
      </div>
    )
  }

  return (
    <section className="space-y-5">
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Comments</h2>
          <span className="text-xs text-slate-400">{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
        </div>
        {comments.length === 0 && (
          <p className="text-sm text-slate-400">Be the first to share a print tip, build note, or result.</p>
        )}
        {makerGallery.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Maker gallery</h3>
              <span className="text-xs text-slate-500">
                {makerGallery.length} {makerGallery.length === 1 ? 'photo' : 'photos'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {makerGallery.map((make) => (
                <figure key={`make-${make.id}`} className="rounded-lg border border-white/5 bg-black/30 overflow-hidden">
                  {make.imageUrl && (
                    <a href={make.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={make.imageUrl}
                        alt={`${make.user.displayName}'s make`}
                        className="w-full h-24 object-cover"
                        loading="lazy"
                      />
                    </a>
                  )}
                  <figcaption className="px-2 py-1 text-xs text-slate-300 truncate">
                    by {make.user.displayName}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
        {reviewedParts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-200">Part review filters</h3>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-white"
                onClick={() => setActivePartFilter('all')}
              >
                Show all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {reviewedParts.map((part) => (
                <button
                  key={part.partId}
                  type="button"
                  onClick={() => setActivePartFilter(part.partId)}
                  className={`rounded-full border px-3 py-1 text-xs ${activePartFilter === part.partId ? 'border-sky-400/40 bg-sky-500/10 text-sky-100' : 'border-white/10 text-slate-300 hover:border-white/20'}`}
                >
                  {part.partName}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-4">
          {visibleComments.map((comment) => {
            const isMake = comment.type === 'make'
            return (
              <article key={comment.id} className="border border-white/5 rounded-lg p-3 bg-black/20">
                <div className="flex gap-3">
                  {renderAvatar(comment)}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {comment.user?.profileSlug ? (
                        <Link href={`/u/${comment.user.profileSlug}`} className="font-semibold hover:underline">
                          {comment.user.displayName}
                        </Link>
                      ) : (
                        <span className="font-semibold">{comment.user?.displayName}</span>
                      )}
                      {comment.isVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-200">
                          <span aria-hidden="true">✓</span>
                          Verified
                        </span>
                      )}
                      {isMake && (
                        <span className="inline-flex items-center rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-sky-200">
                          Make
                        </span>
                      )}
                      {comment.partReview && (
                        <button
                          type="button"
                          onClick={() => setActivePartFilter(comment.partReview?.partId || 'all')}
                          className="inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-cyan-100"
                        >
                          Part: {comment.partReview.partName}
                        </button>
                      )}
                      {comment.partReview?.pin && (
                        <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-100">
                          Pin {comment.partReview.pin.x.toFixed(1)}, {comment.partReview.pin.y.toFixed(1)}, {comment.partReview.pin.z.toFixed(1)}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">{formatTimestamp(comment.createdAt)}</span>
                    </div>
                    {comment.body && (
                      <p className="text-slate-200 whitespace-pre-wrap">
                        {comment.body}
                      </p>
                    )}
                    {comment.imageUrl && (
                      <a
                        href={comment.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full max-w-xs sm:max-w-sm overflow-hidden rounded-lg border border-white/5 bg-black/40"
                      >
                        <img
                          src={comment.imageUrl}
                          alt={`Photo shared by ${comment.user.displayName}`}
                          className="w-full h-auto max-h-56 object-cover"
                          loading="lazy"
                        />
                      </a>
                    )}
                  </div>
                  {canModerate && (
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-white px-2 py-1"
                      onClick={() => deleteComment(comment.id)}
                      disabled={isDeleting(comment.id)}
                    >
                      {isDeleting(comment.id) ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
      <div id="model-comments-compose" className="glass rounded-xl p-5">
        {currentUserId ? (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm font-medium">Add a comment</label>
            {selectedPartReview && (
              <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 flex items-center justify-between gap-3">
                <span>
                  Reviewing part: {selectedPartReview.partName}
                  {selectedPartReview.pin ? ` · Pin ${selectedPartReview.pin.x.toFixed(1)}, ${selectedPartReview.pin.y.toFixed(1)}, ${selectedPartReview.pin.z.toFixed(1)}` : ''}
                </span>
                <button
                  type="button"
                  className="text-cyan-50/80 hover:text-cyan-50"
                  onClick={() => setSelectedPartReview(null)}
                >
                  Clear
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${commentType === 'comment' ? 'bg-brand-500/10 border-brand-400 text-white' : 'border-white/10 text-slate-300 hover:border-white/20'}`}
                onClick={() => handleTypeChange('comment')}
              >
                Comment
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${commentType === 'make' ? 'bg-sky-500/10 border-sky-400 text-white' : 'border-white/10 text-slate-300 hover:border-white/20'}`}
                onClick={() => handleTypeChange('make')}
              >
                Share a Make
              </button>
            </div>
            <textarea
              className="input h-32"
              placeholder={commentType === 'make'
                ? 'How did the print turn out? Mention slicer tweaks, paints, or assembly notes...'
                : 'Share print settings, finishing tips, or results...'}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              disabled={submitting}
            />
            {commentType === 'make' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">Make photo</label>
                <input
                  type="file"
                  accept={IMAGE_ACCEPT_ATTRIBUTE}
                  onChange={handleFileChange}
                  disabled={submitting}
                  className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/20"
                />
                <p className="text-xs text-slate-500">
                  Share a real-world photo (JPEG, PNG, WebP). We&rsquo;ll resize it automatically.
                </p>
                {makeImage && (
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="truncate">{makeImage.name}</span>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-white"
                      onClick={() => setMakeImage(null)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <div className="flex items-center gap-3">
              <button type="submit" className="btn" disabled={submitting}>
                {submitting ? 'Posting...' : 'Post comment'}
              </button>
              <span className="text-xs text-slate-500">{body.trim().length}/1000</span>
            </div>
          </form>
        ) : (
          <div className="text-sm text-slate-300">
            <p>Sign in to ask questions or share your experience.</p>
            <Link href="/login" className="text-brand-300 hover:text-brand-200 underline underline-offset-4">Log in to comment</Link>
          </div>
        )}
      </div>
    </section>
  )
}
