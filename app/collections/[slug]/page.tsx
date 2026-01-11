import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buildImageSrc } from '@/lib/public-path'
import { formatPriceLabel } from '@/lib/price-label'
import DiscoverModelList from '@/components/discover/DiscoverModelList'
import { listActiveCollections, getCollectionBySlug, getCollectionModels } from '@/lib/collections'
import { DiscoverViewMode, type CardInfo } from '@/types/discover'

export const dynamic = 'force-dynamic'

type CollectionDetailProps = { params: Promise<{ slug: string }> }

export default async function CollectionDetailPage({ params }: CollectionDetailProps) {
  const { slug } = await params
  const collection = await getCollectionBySlug(slug)
  if (!collection) return notFound()
  const models = await getCollectionModels(collection, 36)
  const cards: CardInfo[] = models.map((model) => {
    const coverSrc = buildImageSrc(model.coverImagePath, model.updatedAt)
    const priceLabel = formatPriceLabel(model.priceUsd, { from: Boolean(model.salePriceIsFrom), unit: model.salePriceUnit || undefined })
    const partsLabel = typeof model.partsCount === 'number' && model.partsCount > 0 ? `${model.partsCount} part${model.partsCount === 1 ? '' : 's'}` : null
    const sizeLabel = model.sizeXmm && model.sizeYmm && model.sizeZmm
      ? `${Math.round(model.sizeXmm)} x ${Math.round(model.sizeYmm)} x ${Math.round(model.sizeZmm)} mm`
      : 'N/A'
    return { model, coverSrc, priceLabel, sizeLabel, partsLabel }
  })
  const hero = buildImageSrc(collection.heroImagePath, null)

  return (
    <div className="space-y-6">
      <Link href="/collections" className="text-sm text-slate-400 hover:text-white underline underline-offset-4">
        Back to collections
      </Link>
      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6 items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Collection</p>
          <h1 className="text-3xl font-semibold mt-2">{collection.title}</h1>
          {collection.description ? (
            <p className="text-sm text-slate-400 mt-3">{collection.description}</p>
          ) : null}
          {collection.kind === 'material_popular' && collection.materialKey ? (
            <p className="text-xs text-brand-300 mt-3 uppercase tracking-[0.3em]">
              Popular in {collection.materialKey}
            </p>
          ) : null}
        </div>
        {hero ? (
          <img src={hero} alt="" className="w-full h-56 object-cover rounded-2xl border border-white/10" />
        ) : (
          <div className="w-full h-56 rounded-2xl border border-white/10 bg-slate-900/60" />
        )}
      </div>
      {cards.length === 0 ? (
        <div className="glass p-6 rounded-xl text-slate-400">No models available in this collection yet.</div>
      ) : (
        <DiscoverModelList cards={cards} viewMode={DiscoverViewMode.Grid} canLike={false} />
      )}
    </div>
  )
}
