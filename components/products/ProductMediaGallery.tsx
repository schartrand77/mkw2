"use client"

import { useState } from 'react'

type Props = {
  images: string[]
  title: string
}

export default function ProductMediaGallery({ images, title }: Props) {
  const gallery = images.length > 0 ? images : []
  const [activeIndex, setActiveIndex] = useState(0)
  const hero = gallery[activeIndex] || gallery[0] || null

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
        {hero ? (
          <img src={hero} alt={title} className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center text-sm text-slate-500">No product image</div>
        )}
      </div>
      {gallery.length > 1 && (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {gallery.slice(0, 10).map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              aria-label={`View ${title} image ${index + 1}`}
              aria-pressed={index === activeIndex}
              className={`overflow-hidden rounded-lg border bg-slate-950 transition ${index === activeIndex ? 'border-brand-300 ring-2 ring-brand-300/30' : 'border-white/10 hover:border-white/30'}`}
              onClick={() => setActiveIndex(index)}
            >
              <img src={src} alt={`${title} view ${index + 1}`} className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
