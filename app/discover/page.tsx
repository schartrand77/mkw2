import Link from 'next/link'
import { cookies } from 'next/headers'
import ViewPreferenceSync from '@/components/discover/ViewPreferenceSync'
import ViewToggle from '@/components/discover/ViewToggle'
import DiscoverFilters from '@/components/discover/DiscoverFilters'
import DiscoverPresetBar from '@/components/discover/DiscoverPresetBar'
import { buildImageSrc } from '@/lib/public-path'
import { formatPriceLabel } from '@/lib/price-label'
import { DiscoverEntityType, DiscoverViewMode, type CardInfo, type DiscoverModel } from '@/types/discover'
import { resolveBaseUrl } from '@/lib/base-url'
import { getUserIdFromCookie } from '@/lib/auth'
import { listActiveCollections } from '@/lib/collections'
import { CACHE_TAGS, CACHE_TTL_SECONDS } from '@/lib/cache-policy'
type SearchParams = { [key: string]: string | string[] | undefined }

import DiscoverModelList from '@/components/discover/DiscoverModelList'

async function fetchModels(params: URLSearchParams, baseUrl: string) {
  const qs = params.toString()
  const readyMode = params.get('ready') === '1'
  const res = await fetch(`${baseUrl}/api/models${qs ? `?${qs}` : ''}`, {
    ...(readyMode
      ? { cache: 'no-store' as const }
      : {
        next: {
          revalidate: CACHE_TTL_SECONDS.discoverModels,
          tags: [CACHE_TAGS.discoverModels],
        },
      }),
  })
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
  const storedView = cookieStore.get('mwv2_discover_view')?.value === DiscoverViewMode.Compact ? DiscoverViewMode.Compact : DiscoverViewMode.Grid
  const requestedView = params.get('view')
  const viewMode: DiscoverViewMode =
    requestedView === DiscoverViewMode.Compact ? DiscoverViewMode.Compact : requestedView === DiscoverViewMode.Grid ? DiscoverViewMode.Grid : storedView
  if (viewMode === DiscoverViewMode.Grid) params.delete('view')
  else params.set('view', DiscoverViewMode.Compact)
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
  const pageSize = Math.min(60, Math.max(6, parseInt(params.get('pageSize') || '24', 10) || 24))
  const sort = params.get('sort') || 'latest'
  const q = params.get('q') || ''
  const ready = params.get('ready') === '1'
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))

  const fetchParams = new URLSearchParams(params)
  fetchParams.delete('view')
  const baseUrl = await resolveBaseUrl()
  const userId = await getUserIdFromCookie()
  const canLike = Boolean(userId)
  const collections = await listActiveCollections(4)
  const data = await fetchModels(fetchParams, baseUrl) as { models?: DiscoverModel[]; total?: number }
  const models: DiscoverModel[] = Array.isArray(data.models) ? data.models : []
  const suggestedMaterials = Array.from(new Set(
    models
      .map((model) => model.material?.trim())
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase()),
  )).slice(0, 6)
  const suggestedTags = Array.from(new Map(
    models
      .flatMap((model) => model.tags || [])
      .map((tag) => [tag.slug, tag]),
  ).values()).slice(0, 6)
  const total = typeof data.total === 'number' ? data.total : 0
  const safeTotal = total || 0
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize))
  const showingStart = safeTotal > 0 ? (page - 1) * pageSize + 1 : 0
  const showingEnd = safeTotal > 0 ? Math.min(safeTotal, (page - 1) * pageSize + (models?.length || 0)) : 0
  const cards: CardInfo[] = models.map((m) => {
    const coverSrc = buildImageSrc(m.coverImagePath, m.updatedAt)
    const hasCustomPrice = m.salePriceUsd != null && Number.isFinite(Number(m.salePriceUsd))
    const priceLabel = formatPriceLabel(m.priceUsd, {
      from: hasCustomPrice ? false : Boolean(m.salePriceIsFrom),
      unit: m.salePriceUnit || undefined,
    })
    const isModel = (m.entityType || DiscoverEntityType.Model) === DiscoverEntityType.Model
    const partsCount = isModel && typeof m.partsCount === 'number' ? m.partsCount : null
    const partsLabel = partsCount && partsCount > 0 ? `${partsCount} part${partsCount === 1 ? '' : 's'}` : null
    const sizeLabel = m.sizeXmm && m.sizeYmm && m.sizeZmm
      ? `${Math.round(m.sizeXmm)} x ${Math.round(m.sizeYmm)} x ${Math.round(m.sizeZmm)} mm`
      : isModel ? 'N/A' : 'Configured'
    return { model: m, coverSrc, priceLabel, sizeLabel, partsLabel }
  })
  const gridViewHref = buildQS({ page: 1, view: viewMode === DiscoverViewMode.Compact ? DiscoverViewMode.Grid : '' }, params)
  const compactViewHref = buildQS({ page: 1, view: DiscoverViewMode.Compact }, params)

  return (
    <div className="space-y-6">
      <ViewPreferenceSync viewMode={viewMode} storedView={storedView} />
      <section className="glass overflow-hidden rounded-[1.75rem] border border-white/10 p-5 md:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)] lg:items-start">
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.34em] text-brand-300/80">Discover v3</p>
              <h1 className="page-title text-3xl font-semibold md:text-4xl">Search, filter, and route work faster.</h1>
              <p className="max-w-2xl text-sm text-slate-300 md:text-base">
                Discover now pulls models, products, and merch into one search flow with smarter scopes, reusable presets, and clearer production-oriented sorting.
              </p>
            </div>
            <DiscoverFilters
              q={q}
              sort={sort}
              pageSize={pageSize}
              viewMode={viewMode}
              ready={ready}
              suggestedMaterials={suggestedMaterials}
              suggestedTags={suggestedTags}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Result set</p>
              <p className="mt-2 text-2xl font-semibold text-white">{safeTotal}</p>
              <p className="mt-1 text-sm text-slate-400">
                {safeTotal > 0 ? `Showing ${showingStart}-${showingEnd} on page ${page}.` : 'Refine the query to explore the full catalog.'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Search mode</p>
              <p className="mt-2 text-base font-semibold text-white">{q ? 'Unified search' : 'Model library focus'}</p>
              <p className="mt-1 text-sm text-slate-400">
                {q ? 'Text search spans models, products, and merch unless you scope it.' : 'Browse public models by latest activity, pricing, and readiness.'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Workflow</p>
              <div className="mt-2">
                <ViewToggle viewMode={viewMode} gridHref={gridViewHref} compactHref={compactViewHref} />
              </div>
            </div>
          </div>
        </div>
      </section>
      <DiscoverPresetBar canSave={canLike} />
      {ready && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Ready to Print now requires lower-risk model scores and live in-stock material availability.
        </div>
      )}
      {collections.length > 0 && (
        <div className="glass rounded-2xl border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Featured collections</h2>
            <Link href="/collections" className="text-xs text-brand-300 underline underline-offset-4">
              View all
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {collections.map((collection) => (
              <Link
                key={collection.id}
                href={`/collections/${collection.slug}`}
                className="rounded-xl border border-white/10 bg-black/20 p-3 hover:border-white/20 transition"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Collection</p>
                <p className="font-medium mt-2">{collection.title}</p>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {collection.description || 'Explore the curated lineup.'}
                </p>
                {collection.kind === 'material_popular' && collection.materialKey ? (
                  <p className="text-[10px] uppercase tracking-[0.3em] text-brand-300 mt-2">
                    Popular in {collection.materialKey}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {safeTotal > 0 ? `Showing ${showingStart}-${showingEnd} of ${safeTotal} results` : 'No results in this result set'}
        </p>
        <div className="text-xs text-slate-500">
          Sort: <span className="text-slate-300">{sort.replaceAll('_', ' ')}</span>
        </div>
      </div>

      <DiscoverModelList cards={cards} viewMode={viewMode} canLike={canLike} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          <Link
            href={buildQS({ page: 1 }, params)}
            className={`px-3 py-1.5 rounded-md border ${page === 1 ? 'opacity-60 cursor-default' : 'hover:border-white/20'} border-white/10`}
            aria-disabled={page === 1}
          >
            First
          </Link>
          <Link
            href={buildQS({ page: Math.max(1, page - 1) }, params)}
            className={`px-3 py-1.5 rounded-md border ${page === 1 ? 'opacity-60 cursor-default' : 'hover:border-white/20'} border-white/10`}
            aria-disabled={page === 1}
          >
            Prev
          </Link>
          <div className="px-3 py-1.5 rounded-md border border-white/10 text-sm text-slate-300">
            Page {page} / {totalPages}
          </div>
          <Link
            href={buildQS({ page: Math.min(totalPages, page + 1) }, params)}
            className={`px-3 py-1.5 rounded-md border ${page === totalPages ? 'opacity-60 cursor-default' : 'hover:border-white/20'} border-white/10`}
            aria-disabled={page === totalPages}
          >
            Next
          </Link>
          <Link
            href={buildQS({ page: totalPages }, params)}
            className={`px-3 py-1.5 rounded-md border ${page === totalPages ? 'opacity-60 cursor-default' : 'hover:border-white/20'} border-white/10`}
            aria-disabled={page === totalPages}
          >
            Last
          </Link>
        </div>
      )}
    </div>
  )
}
