import Link from 'next/link'
import { formatCurrency } from '@/lib/currency'
import AddToCartButtons from '@/components/cart/AddToCartButtons'
import { DiscoverViewMode, type CardInfo } from '@/types/discover'

type DiscoverModelListProps = {
  cards: CardInfo[]
  viewMode: DiscoverViewMode
}

export default function DiscoverModelList({ cards, viewMode }: DiscoverModelListProps) {
  const hasModels = cards.length > 0

  return (
    <>
      {hasModels ? (
        viewMode === DiscoverViewMode.Compact ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ model: m, coverSrc, priceLabel, sizeLabel, partsLabel }) => (
              <Link
                key={m.id}
                href={`/models/${m.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-white/10 hover:border-white/20 bg-slate-900/40 px-3 py-3 sm:px-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt={m.title}
                    className="w-20 h-16 object-cover rounded-xl border border-white/10"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-20 h-16 bg-slate-900/60 rounded-xl border border-white/10 flex items-center justify-center text-[10px] text-slate-500">
                    No image
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm leading-5 line-clamp-1">{m.title}</div>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">{m.fileType || 'Unknown'}</span>
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                    {partsLabel && <span>{partsLabel}</span>}
                    <span>{sizeLabel}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{priceLabel || 'N/A'}</span>
                      {priceLabel && m.saleActive && m.basePriceUsd && (
                        <span className="text-[11px] text-slate-500 line-through">{formatCurrency(m.basePriceUsd)}</span>
                      )}
                    </div>
                    <AddToCartButtons model={{
                      id: m.id,
                      title: m.title,
                      priceUsd: m.priceUsd,
                      coverImagePath: m.coverImagePath,
                      updatedAt: m.updatedAt,
                      sizeXmm: m.sizeXmm ?? undefined,
                      sizeYmm: m.sizeYmm ?? undefined,
                      sizeZmm: m.sizeZmm ?? undefined,
                    }} />
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 flex gap-4">
                    <span>Likes: {m.likes}</span>
                    <span>Downloads: {m.downloads}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <section className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {cards.map(({ model: m, coverSrc, priceLabel, sizeLabel, partsLabel }) => (
              <Link key={m.id} href={`/models/${m.id}`} className="glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
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
                <div className="p-4 space-y-2">
                  <h3 className="text-lg font-semibold line-clamp-2">{m.title}</h3>
                  <div className="text-xs text-slate-400 flex gap-4">
                    <span>{m.fileType || 'Unknown format'}</span>
                    {partsLabel && <span>{partsLabel}</span>}
                  </div>
                  <AddToCartButtons model={{
                    id: m.id,
                    title: m.title,
                    priceUsd: m.priceUsd,
                    coverImagePath: m.coverImagePath,
                    updatedAt: m.updatedAt,
                    sizeXmm: m.sizeXmm ?? undefined,
                    sizeYmm: m.sizeYmm ?? undefined,
                    sizeZmm: m.sizeZmm ?? undefined,
                  }} />
                  <div className="flex justify-between text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{priceLabel || 'N/A'}</span>
                      {priceLabel && m.saleActive && m.basePriceUsd && (
                        <span className="text-xs text-slate-500 line-through">{formatCurrency(m.basePriceUsd)}</span>
                      )}
                    </div>
                    <span>{sizeLabel}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Likes: {m.likes}</span>
                    <span>Downloads: {m.downloads}</span>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )
      ) : (
        <p className="text-slate-400">No models matched your filters.</p>
      )}
    </>
  )
}
