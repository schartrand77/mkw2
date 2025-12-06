import Link from 'next/link'
import { cookies } from 'next/headers'
import ViewPreferenceSync from '@/components/discover/ViewPreferenceSync'
import ViewToggle from '@/components/discover/ViewToggle'
import { formatCurrency } from '@/lib/currency'
import AddToCartButtons from '@/components/cart/AddToCartButtons'
import { buildImageSrc } from '@/lib/public-path'
import { formatPriceLabel } from '@/lib/price-label'

type SearchParams = { [key: string]: string | string[] | undefined }
type DiscoverModel = {
  id: string
  title: string
  coverImagePath?: string | null
  updatedAt?: string | null
  fileType?: string | null
  partsCount?: number | null
  priceUsd?: number | null
  basePriceUsd?: number | null
  saleActive?: boolean | null
  salePriceIsFrom?: boolean | null
  salePriceUnit?: string | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  likes?: number | null
  downloads?: number | null
}
type CardInfo = {
  model: DiscoverModel
  coverSrc?: string | null
  priceLabel?: string | null
  sizeLabel: string
  partsLabel: string | null
}

async function fetchModels(params: URLSearchParams) {
  const qs = params.toString()
  const res = await fetch(`${process.env.BASE_URL || ''}/api/models${qs ? `?${qs}` : ''}`, { cache: 'no-store' })
  if (!res.ok) return { models: [], total: 0, page: 1, pageSize: 24 }
  return res.json()
}

function buildQS(next: Record<string, any>, current: URLSearchParams) {
  const merged = new URLSearchParams(current)
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined || v === null || v === '') merged.delete(k)
    else merged.set(k, String(v))
  }
  return `?${merged.toString()}`
}

type DiscoverPageProps = { searchParams?: Promise<SearchParams> }

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const params = new URLSearchParams()
  if (searchParams) {
    const resolvedSearchParams = await searchParams
    for (const [k, v] of Object.entries(resolvedSearchParams)) {
      if (Array.isArray(v)) params.set(k, v[0]!)
      else if (v) params.set(k, v)
    }
  }
  const cookieStore = await cookies()
  const storedView = cookieStore.get('mwv2_discover_view')?.value === 'compact' ? 'compact' : 'grid'
  const requestedView = params.get('view')
  const viewMode: 'grid' | 'compact' =
    requestedView === 'compact' ? 'compact' : requestedView === 'grid' ? 'grid' : storedView
  if (viewMode === 'grid') params.delete('view')
  else params.set('view', 'compact')
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
  const pageSize = Math.min(60, Math.max(6, parseInt(params.get('pageSize') || '24', 10) || 24))
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))

  const fetchParams = new URLSearchParams(params)
  fetchParams.delete('view')

  const data = await fetchModels(fetchParams) as { models?: DiscoverModel[]; total?: number }
  const models: DiscoverModel[] = Array.isArray(data.models) ? data.models : []
  const total = typeof data.total === 'number' ? data.total : 0
  const safeTotal = total || 0
  const q = params.get('q') || ''
  const sort = params.get('sort') || 'latest'
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize))
  const showingStart = safeTotal > 0 ? (page - 1) * pageSize + 1 : 0
  const showingEnd = safeTotal > 0 ? Math.min(safeTotal, (page - 1) * pageSize + (models?.length || 0)) : 0
  const cards: CardInfo[] = models.map((m) => {
    const coverSrc = buildImageSrc(m.coverImagePath, m.updatedAt)
    const priceLabel = formatPriceLabel(m.priceUsd, { from: Boolean(m.salePriceIsFrom), unit: m.salePriceUnit || undefined })
    const partsCount = typeof m.partsCount === 'number' ? m.partsCount : null
    const partsLabel = partsCount && partsCount > 0 ? `${partsCount} part${partsCount === 1 ? '' : 's'}` : null
    const sizeLabel = m.sizeXmm && m.sizeYmm && m.sizeZmm
      ? `${Math.round(m.sizeXmm)} x ${Math.round(m.sizeYmm)} x ${Math.round(m.sizeZmm)} mm`
      : 'N/A'
    return { model: m, coverSrc, priceLabel, sizeLabel, partsLabel }
  })
  const hasModels = cards.length > 0
  const gridViewHref = buildQS({ page: 1, view: viewMode === 'compact' ? 'grid' : '' }, params)
  const compactViewHref = buildQS({ page: 1, view: 'compact' }, params)

  return (
    <div className="space-y-6">
      <ViewPreferenceSync viewMode={viewMode} storedView={storedView} />
      <h1 className="page-title text-3xl font-semibold">Discover Models</h1>
      <form method="get" className="grid md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Search</label>
          <input className="input" type="search" name="q" defaultValue={q} placeholder="Search models..." />
        </div>
        <div>
          <label className="block text-sm mb-1">Sort</label>
          <select name="sort" defaultValue={sort} className="input">
            <option value="latest">Latest</option>
            <option value="popular">Popular</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Per page</label>
          <select name="pageSize" defaultValue={pageSize} className="input">
            {[12, 24, 36, 48, 60].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <input type="hidden" name="page" value="1" />
        {viewMode === 'compact' && <input type="hidden" name="view" value="compact" />}
        <div className="md:col-span-3">
          <button className="btn">Apply Filters</button>
        </div>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Showing {safeTotal > 0 ? `${showingStart}-${showingEnd}` : 0} of {safeTotal} models
        </p>
        <ViewToggle viewMode={viewMode} gridHref={gridViewHref} compactHref={compactViewHref} />
      </div>

      {hasModels ? (
        viewMode === 'compact' ? (
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          <Link
            href={buildQS({ page: 1 }, params)}
            className={`px-3 py-1.5 rounded-md border ${page === 1 ? 'opacity-60 cursor-default' : 'hover:border-white/20'} border-white/10`}
            aria-disabled={page === 1}
          >
            « First
          </Link>
          <Link
            href={buildQS({ page: Math.max(1, page - 1) }, params)}
            className={`px-3 py-1.5 rounded-md border ${page === 1 ? 'opacity-60 cursor-default' : 'hover:border-white/20'} border-white/10`}
            aria-disabled={page === 1}
          >
            ‹ Prev
          </Link>
          <div className="px-3 py-1.5 rounded-md border border-white/10 text-sm text-slate-300">
            Page {page} / {totalPages}
          </div>
          <Link
            href={buildQS({ page: Math.min(totalPages, page + 1) }, params)}
            className={`px-3 py-1.5 rounded-md border ${page === totalPages ? 'opacity-60 cursor-default' : 'hover:border-white/20'} border-white/10`}
            aria-disabled={page === totalPages}
          >
            Next ›
          </Link>
          <Link
            href={buildQS({ page: totalPages }, params)}
            className={`px-3 py-1.5 rounded-md border ${page === totalPages ? 'opacity-60 cursor-default' : 'hover:border-white/20'} border-white/10`}
            aria-disabled={page === totalPages}
          >
            Last »
          </Link>
        </div>
      )}
    </div>
  )
}
