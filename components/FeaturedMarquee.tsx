'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { buildImageSrc } from '@/lib/public-path'
import { formatPriceLabel } from '@/lib/price-label'

type FeaturedMarqueeProps = {
  models: any[]
  variant?: 'default' | 'compact'
}

export default function FeaturedMarquee({ models, variant = 'default' }: FeaturedMarqueeProps) {
  const HOLD_MS = 4400
  const SLIDE_MS = 500
  const minVisibleCards = 6
  const baseRepeatCount = models.length > 0 ? Math.max(1, Math.ceil(minVisibleCards / models.length)) : 1
  const baseSequence = Array.from({ length: baseRepeatCount }, () => models).flat()
  const sequenceLength = baseSequence.length
  const loop = [...baseSequence, ...baseSequence, ...baseSequence]
  const startIndex = sequenceLength
  const isCompact = variant === 'compact'
  const [paused, setPaused] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(startIndex)
  const [resettingPosition, setResettingPosition] = useState(false)
  const [stepPx, setStepPx] = useState(0)
  const [firstCardWidth, setFirstCardWidth] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const cardClassName = isCompact
    ? 'w-[220px] flex-shrink-0 glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition'
    : 'w-[280px] sm:w-[320px] md:w-[360px] flex-shrink-0 glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition'
  const bodyClassName = isCompact ? 'p-3' : 'p-4'
  const titleClassName = isCompact ? 'text-sm font-semibold truncate' : 'font-semibold truncate'
  const priceClassName = isCompact ? 'text-xs text-slate-400' : 'text-sm text-slate-400'

  useEffect(() => {
    setCurrentIndex(startIndex)
  }, [startIndex])

  useEffect(() => {
    const track = trackRef.current
    const viewport = viewportRef.current
    if (!track || !viewport) return
    const measure = () => {
      const cards = track.querySelectorAll<HTMLElement>('[data-marquee-card="true"]')
      if (cards.length === 0) return
      const first = cards[0]
      const second = cards[1]
      const firstRect = first.getBoundingClientRect()
      setFirstCardWidth(firstRect.width)
      setViewportWidth(viewport.getBoundingClientRect().width)
      if (second) {
        setStepPx(second.offsetLeft - first.offsetLeft)
        return
      }
      const gapRaw = getComputedStyle(track).columnGap || getComputedStyle(track).gap
      const gap = Number.parseFloat(gapRaw || '0')
      setStepPx(firstRect.width + (Number.isFinite(gap) ? gap : 0))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [sequenceLength])

  useEffect(() => {
    if (paused || sequenceLength === 0) return
    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => prev + 1)
    }, HOLD_MS + SLIDE_MS)
    return () => window.clearInterval(interval)
  }, [paused, sequenceLength])

  useEffect(() => {
    if (sequenceLength === 0 || currentIndex < sequenceLength * 2) return
    const timeout = window.setTimeout(() => {
      setResettingPosition(true)
      setCurrentIndex(startIndex)
    }, SLIDE_MS)
    return () => window.clearTimeout(timeout)
  }, [currentIndex, sequenceLength, startIndex])

  useEffect(() => {
    if (!resettingPosition) return
    const raf = window.requestAnimationFrame(() => setResettingPosition(false))
    return () => window.cancelAnimationFrame(raf)
  }, [resettingPosition])

  const centerOffset = viewportWidth > 0 && firstCardWidth > 0 ? (viewportWidth - firstCardWidth) / 2 : 0
  const translateX = centerOffset - currentIndex * stepPx
  return (
    <div ref={viewportRef} className="marquee-viewport glass rounded-2xl border border-white/10 p-4">
      <div className="marquee-fade marquee-fade-left" aria-hidden="true" />
      <div className="marquee-fade marquee-fade-right" aria-hidden="true" />
      <button
        type="button"
        className="marquee-control"
        aria-pressed={paused}
        aria-label={paused ? 'Play marquee' : 'Pause marquee'}
        title={paused ? 'Play marquee' : 'Pause marquee'}
        onClick={() => setPaused((prev) => !prev)}
      >
        {paused ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="marquee-control-icon">
            <path d="M8 6l10 6-10 6V6z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="marquee-control-icon">
            <path d="M7 6h4v12H7zM13 6h4v12h-4z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div
        ref={trackRef}
        className="marquee-track"
        style={{
          transform: `translateX(${translateX}px)`,
          transitionDuration: resettingPosition ? '0ms' : `${SLIDE_MS}ms`,
          transitionTimingFunction: 'ease',
          transitionProperty: 'transform',
        }}
      >
        {loop.map((model, idx) => (
          <FeaturedCard
            key={`${model.id}-${idx}`}
            model={model}
            ariaHidden={idx < startIndex || idx >= startIndex + sequenceLength}
            cardClassName={cardClassName}
            bodyClassName={bodyClassName}
            titleClassName={titleClassName}
            priceClassName={priceClassName}
          />
        ))}
      </div>
    </div>
  )
}

function FeaturedCard({
  model,
  ariaHidden = false,
  cardClassName,
  bodyClassName,
  titleClassName,
  priceClassName,
}: {
  model: any
  ariaHidden?: boolean
  cardClassName: string
  bodyClassName: string
  titleClassName: string
  priceClassName: string
}) {
  const coverSrc = buildImageSrc(model.coverImagePath, model.updatedAt)
  const hasCustomPrice = model.salePriceUsd != null && Number.isFinite(Number(model.salePriceUsd))
  const priceLabel = formatPriceLabel(model.priceUsd, {
    from: hasCustomPrice ? false : model.salePriceIsFrom,
    unit: model.salePriceUnit,
  })
  return (
    <Link
      href={`/models/${model.id}`}
      className={cardClassName}
      data-marquee-card="true"
      aria-hidden={ariaHidden}
      tabIndex={ariaHidden ? -1 : undefined}
    >
      {coverSrc ? (
        <img
          src={coverSrc}
          alt={model.title}
          className="aspect-video w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="aspect-video w-full bg-slate-900/60 flex items-center justify-center text-slate-400">No image</div>
      )}
      <div className={bodyClassName}>
        <h3 className={titleClassName}>{model.title}</h3>
        {priceLabel ? (
          <p className={priceClassName}>Est. {priceLabel}</p>
        ) : (
          <p className={priceClassName}>No estimate</p>
        )}
      </div>
    </Link>
  )
}
