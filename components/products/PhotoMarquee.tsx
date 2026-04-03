"use client"

import { useMemo } from 'react'

type PhotoMarqueeProps = {
  images: string[]
  altBase: string
}

export default function PhotoMarquee({ images, altBase }: PhotoMarqueeProps) {
  const slides = useMemo(() => {
    const cleaned = Array.from(new Set(images.map((src) => String(src || '').trim()).filter(Boolean)))
    if (cleaned.length === 0) return []
    if (cleaned.length >= 3) return cleaned
    const padded = [...cleaned]
    while (padded.length < 3) padded.push(cleaned[padded.length % cleaned.length])
    return padded
  }, [images])

  if (slides.length === 0) {
    return (
      <div className="h-28 rounded-lg border border-white/10 bg-slate-900/60 flex items-center justify-center text-[11px] text-slate-500">
        No photos
      </div>
    )
  }

  const visible = slides.slice(0, 3)

  return (
    <div className="grid grid-cols-3 gap-2">
      {visible.map((src, idx) => (
        <div key={`${src}-${idx}`} className="rounded-lg border border-white/10 bg-slate-900/60 overflow-hidden h-28">
          <img
            src={src}
            alt={`${altBase} photo ${idx + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      ))}
    </div>
  )
}
