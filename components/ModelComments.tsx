"use client"

import Link from 'next/link'
import { FormEvent, useMemo, useState } from 'react'
import { useNotifications } from '@/components/notifications/NotificationsProvider'

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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<string[]>([])
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
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/models/${modelId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to add comment')
      }
      if (data?.comment) {
        setComments(prev => [...prev, data.comment])
      }
      setBody('')
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
        <div className="space-y-4">
          {comments.map((comment) => (
            <article key={comment.id} className="border border-white/5 rounded-lg p-3 bg-black/20">
              <div className="flex gap-3">
                {renderAvatar(comment)}
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {comment.user?.profileSlug ? (
                      <Link href={`/u/${comment.user.profileSlug}`} className="font-semibold hover:underline">
                        {comment.user.displayName}
                      </Link>
                    ) : (
                      <span className="font-semibold">{comment.user?.displayName}</span>
                    )}
                    <span className="text-xs text-slate-500">{formatTimestamp(comment.createdAt)}</span>
                  </div>
                  <p className="text-slate-200 whitespace-pre-wrap">{comment.body}</p>
                </div>
                {canModerate && (
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-white px-2 py-1"
                    onClick={() => deleteComment(comment.id)}
                    disabled={isDeleting(comment.id)}
                  >
                    {isDeleting(comment.id) ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="glass rounded-xl p-5">
        {currentUserId ? (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm font-medium">Add a comment</label>
            <textarea
              className="input h-32"
              placeholder="Share print settings, finishing tips, or results…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              disabled={submitting}
            />
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <div className="flex items-center gap-3">
              <button type="submit" className="btn" disabled={submitting}>
                {submitting ? 'Posting…' : 'Post comment'}
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
