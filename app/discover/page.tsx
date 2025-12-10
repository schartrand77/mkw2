import Link from 'next/link'
import { cookies } from 'next/headers'
import ViewPreferenceSync from '@/components/discover/ViewPreferenceSync'
import ViewToggle from '@/components/discover/ViewToggle'
import { formatCurrency } from '@/lib/currency'
import AddToCartButtons from '@/components/cart/AddToCartButtons'
import { buildImageSrc } from '@/lib/public-path'
import { formatPriceLabel } from '@/lib/price-label'
import { DiscoverSort, DiscoverViewMode, type CardInfo, type DiscoverModel } from '@/types/discover'
import { resolveBaseUrl } from '@/lib/base-url'

type SearchParams = { [key: string]: string | string[] | undefined }

import DiscoverModelList from '@/components/discover/DiscoverModelList'
import DiscoverFilters from '@/components/discover/DiscoverFilters'

const PAGE_SIZE_OPTIONS = [12, 24, 36, 48, 60]

async function fetchModels(params: URLSearchParams, baseUrl: string) {
  const qs = params.toString()
  const res = await fetch(`${baseUrl}/api/models${qs ? `?${qs}` : ''}`, { cache: 'no-store' })
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
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))

  const fetchParams = new URLSearchParams(params)
  fetchParams.delete('view')
  const baseUrl = resolveBaseUrl()
  const data = await fetchModels(fetchParams, baseUrl) as { models?: DiscoverModel[]; total?: number }
  const models: DiscoverModel[] = Array.isArray(data.models) ? data.models : []
  const total = typeof data.total === 'number' ? data.total : 0
  const safeTotal = total || 0
  const q = params.get('q') || ''
  const sort = params.get('sort') || DiscoverSort.Latest
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
  const gridViewHref = buildQS({ page: 1, view: viewMode === DiscoverViewMode.Compact ? DiscoverViewMode.Grid : '' }, params)
  const compactViewHref = buildQS({ page: 1, view: DiscoverViewMode.Compact }, params)

  return (
    <div className="space-y-6">
      <ViewPreferenceSync viewMode={viewMode} storedView={storedView} />
      <h1 className="page-title text-3xl font-semibold">Discover Models</h1>
      <DiscoverFilters q={q} sort={sort} pageSize={pageSize} viewMode={viewMode} />
<div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Showing {safeTotal > 0 ? `${showingStart}-${showingEnd}` : 0} of {safeTotal} models
        </p>
        <ViewToggle viewMode={viewMode} gridHref={gridViewHref} compactHref={compactViewHref} />
      </div>

      <DiscoverModelList cards={cards} viewMode={viewMode} />

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
