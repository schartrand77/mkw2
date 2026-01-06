import Link from 'next/link'
import { buildImageSrc } from '@/lib/public-path'
import { formatPriceLabel } from '@/lib/price-label'

type FeaturedMarqueeProps = {
  models: any[]
  variant?: 'default' | 'compact'
}

export default function FeaturedMarquee({ models, variant = 'default' }: FeaturedMarqueeProps) {
  const cloneCount = models.length >= 4 ? Math.min(models.length, 4) : 0
  const loop =
    cloneCount > 0
      ? [...models, ...models.slice(0, cloneCount)]
      : models
  const durationSeconds = Math.max(18, models.length * 4)
  const isCompact = variant === 'compact'
  const cardClassName = isCompact
    ? 'w-[220px] flex-shrink-0 glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition'
    : 'w-[280px] sm:w-[320px] md:w-[360px] flex-shrink-0 glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition'
  const bodyClassName = isCompact ? 'p-3' : 'p-4'
  const titleClassName = isCompact ? 'text-sm font-semibold truncate' : 'font-semibold truncate'
  const priceClassName = isCompact ? 'text-xs text-slate-400' : 'text-sm text-slate-400'
  return (
    <div className="marquee-viewport glass rounded-2xl border border-white/10 p-4">
      <div className="marquee-fade marquee-fade-left" aria-hidden="true" />
      <div className="marquee-fade marquee-fade-right" aria-hidden="true" />
      <div className="marquee-track" style={{ animationDuration: `${durationSeconds}s` }}>
        {loop.map((model, idx) => (
          <FeaturedCard
            key={`${model.id}-${idx}`}
            model={model}
            ariaHidden={idx >= models.length}
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
  const priceLabel = formatPriceLabel(model.priceUsd, { from: model.salePriceIsFrom, unit: model.salePriceUnit })
  return (
    <Link
      href={`/models/${model.id}`}
      className={cardClassName}
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
