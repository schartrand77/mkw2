"use client"

import { useState } from 'react'

type DiscoverLikeButtonProps = {
  modelId: string
  initialLikes?: number | null
}

export default function DiscoverLikeButton({ modelId, initialLikes = 0 }: DiscoverLikeButtonProps) {
  const [likes, setLikes] = useState<number>(initialLikes ?? 0)
  const [liked, setLiked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/models/${modelId}/like`, {
        method: 'POST',
        headers: { accept: 'application/json' },
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) return
      const data = await res.json()
      if (typeof data.likes === 'number') setLikes(data.likes)
      if (typeof data.liked === 'boolean') setLiked(data.liked)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <button
      type="button"
      className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20 text-xs"
      onClick={handleClick}
      aria-pressed={liked}
      disabled={submitting}
    >
      {liked ? 'Unlike' : 'Like'} {likes}
    </button>
  )
}
