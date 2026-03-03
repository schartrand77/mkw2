import Link from 'next/link'
import { formatCurrency } from '@/lib/currency'
import AddToCartButtons from '@/components/cart/AddToCartButtons'
import DiscoverLikeButton from '@/components/discover/DiscoverLikeButton'
import { DiscoverEntityType, DiscoverViewMode, type CardInfo } from '@/types/discover'

type DiscoverModelListProps = {
  cards: CardInfo[]
  viewMode: DiscoverViewMode
  canLike?: boolean
}

export default function DiscoverModelList({ cards, viewMode, canLike }: DiscoverModelListProps) {
  const hasModels = cards.length > 0

  const renderAvailability = (status?: string | null, leadTimeDays?: number | null) => {
    if (!status) return null
    const tone = status === 'in_stock'
      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
      : status === 'limited'
        ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
        : status === 'out_of_stock'
          ? 'border-rose-400/40 bg-rose-500/10 text-rose-200'
          : 'border-white/10 bg-white/5 text-slate-300'
    const label = status === 'in_stock'
      ? 'Material in stock'
      : status === 'limited'
        ? 'Limited stock'
        : status === 'out_of_stock'
          ? `Restock ${leadTimeDays ? `~${leadTimeDays}d` : 'TBD'}`
          : 'Stock unknown'
    return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}>{label}</span>
  }

  const renderRecommendation = (reasons?: string[] | null) => {
    if (!reasons?.length) return null
    return (
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-sky-200">
        {reasons.map((reason) => (
          <span key={reason} className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-slate-300">
            {reason}
          </span>
        ))}
      </div>
    )
  }

  return (
    <>
      {hasModels ? (
        viewMode === DiscoverViewMode.Compact ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ model: m, coverSrc, priceLabel, sizeLabel, partsLabel }) => {
              const hasCustomPrice = m.salePriceUsd != null && Number.isFinite(Number(m.salePriceUsd))
              const isModel = (m.entityType || DiscoverEntityType.Model) === DiscoverEntityType.Model
              const href = m.href || `/models/${m.id}`
              return (
              <Link
                key={m.id}
                href={href}
                className="group flex items-center gap-3 rounded-xl border border-white/10 hover:border-white/20 bg-slate-900/40 px-3 py-2 sm:px-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt={m.title}
                    className="w-16 h-14 object-cover rounded-lg border border-white/10"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-16 h-14 bg-slate-900/60 rounded-lg border border-white/10 flex items-center justify-center text-[10px] text-slate-500">
                    No image
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm leading-5 line-clamp-1">{m.title}</div>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">{m.fileType || 'Unknown'}</span>
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                    {partsLabel && <span>{partsLabel}</span>}
                    <span>{sizeLabel}</span>
                    {renderAvailability(m.materialAvailability, m.materialLeadTimeDays)}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{priceLabel || 'N/A'}</span>
                      {priceLabel && !hasCustomPrice && m.saleActive && m.basePriceUsd && (
                        <span className="text-[11px] text-slate-500 line-through">{formatCurrency(m.basePriceUsd)}</span>
                      )}
                    </div>
                    {isModel ? (
                      <div className="flex items-center gap-2">
                        <AddToCartButtons model={{
                          id: m.id,
                          title: m.title,
                          priceUsd: m.priceUsd,
                          flatRatePricing: m.flatRatePricing,
                          coverImagePath: m.coverImagePath,
                          updatedAt: m.updatedAt,
                          sizeXmm: m.sizeXmm ?? undefined,
                          sizeYmm: m.sizeYmm ?? undefined,
                          sizeZmm: m.sizeZmm ?? undefined,
                          defaultColors: Array.isArray(m.defaultColors) ? m.defaultColors : null,
                          colorSlotCount: typeof m.colorSlotCount === 'number' ? m.colorSlotCount : null,
                          allowedColors: Array.isArray(m.allowedColors) ? m.allowedColors : null,
                        }} />
                        {canLike && <DiscoverLikeButton modelId={m.id} initialLikes={m.likes} />}
                      </div>
                    ) : (
                      <span className="text-[11px] uppercase tracking-wide text-brand-300">View details</span>
                    )}
                  </div>
                  {isModel && (
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 flex gap-4">
                      <span>Downloads: {m.downloads ?? 0}</span>
                      <span>Comments: {m.commentsCount ?? 0}</span>
                    </div>
                  )}
                  {renderRecommendation(m.recommendationReasons)}
                </div>
              </Link>
              )
            })}
          </div>
        ) : (
          <section className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {cards.map(({ model: m, coverSrc, priceLabel, sizeLabel, partsLabel }) => {
              const hasCustomPrice = m.salePriceUsd != null && Number.isFinite(Number(m.salePriceUsd))
              const isModel = (m.entityType || DiscoverEntityType.Model) === DiscoverEntityType.Model
              const href = m.href || `/models/${m.id}`
              return (
              <Link key={m.id} href={href} className="glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt={m.title}
                    className="aspect-video w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="aspect-video w-full bg-slate-900/60 flex items-center justify-center text-slate-400">No image</div>
                )}
                <div className="p-3 space-y-1">
                  <h3 className="text-base font-semibold line-clamp-2">{m.title}</h3>
                  <div className="text-[11px] text-slate-400 flex gap-3">
                    <span>{m.fileType || 'Unknown format'}</span>
                    {partsLabel && <span>{partsLabel}</span>}
                    {renderAvailability(m.materialAvailability, m.materialLeadTimeDays)}
                  </div>
                  {isModel ? (
                    <div className="flex items-center gap-2">
                      <AddToCartButtons model={{
                        id: m.id,
                        title: m.title,
                        priceUsd: m.priceUsd,
                        flatRatePricing: m.flatRatePricing,
                        coverImagePath: m.coverImagePath,
                        updatedAt: m.updatedAt,
                        sizeXmm: m.sizeXmm ?? undefined,
                        sizeYmm: m.sizeYmm ?? undefined,
                        sizeZmm: m.sizeZmm ?? undefined,
                        defaultColors: Array.isArray(m.defaultColors) ? m.defaultColors : null,
                        colorSlotCount: typeof m.colorSlotCount === 'number' ? m.colorSlotCount : null,
                        allowedColors: Array.isArray(m.allowedColors) ? m.allowedColors : null,
                      }} />
                      {canLike && <DiscoverLikeButton modelId={m.id} initialLikes={m.likes} />}
                    </div>
                  ) : (
                    <div className="text-xs text-brand-300">Open details</div>
                  )}
                  <div className="flex justify-between text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{priceLabel || 'N/A'}</span>
                      {priceLabel && !hasCustomPrice && m.saleActive && m.basePriceUsd && (
                        <span className="text-[11px] text-slate-500 line-through">{formatCurrency(m.basePriceUsd)}</span>
                      )}
                    </div>
                    <span>{sizeLabel}</span>
                  </div>
                  {isModel && (
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Downloads: {m.downloads ?? 0}</span>
                      <span>Comments: {m.commentsCount ?? 0}</span>
                    </div>
                  )}
                  {renderRecommendation(m.recommendationReasons)}
                </div>
              </Link>
              )
            })}
          </section>
        )
      ) : (
        <p className="text-slate-400">No results matched your filters.</p>
      )}
    </>
  )
}
