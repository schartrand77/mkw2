import Link from 'next/link'
import { formatCurrency } from '@/lib/currency'
import AddToCartButtons from '@/components/cart/AddToCartButtons'
import { buildImageSrc } from '@/lib/public-path'

type SearchParams = { [key: string]: string | string[] | undefined }

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

export default async function DiscoverPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = new URLSearchParams()
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (Array.isArray(v)) params.set(k, v[0]!)
      else if (v) params.set(k, v)
    }
  }
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)
  const pageSize = Math.min(60, Math.max(6, parseInt(params.get('pageSize') || '24', 10) || 24))
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))

  const { models, total } = await fetchModels(params)
  const q = params.get('q') || ''
  const sort = params.get('sort') || 'latest'
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 24)))

  return (
    <div className="space-y-6">
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
        <div className="md:col-span-3">
          <button className="btn">Apply Filters</button>
        </div>
      </form>

      <section className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
        {models.length === 0 && (
          <p className="text-slate-400">No models matched your filters.</p>
        )}
        {models.map((m: any) => {
          const coverSrc = buildImageSrc(m.coverImagePath, m.updatedAt)
          return (
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
                  {m.partsCount > 0 && <span>{m.partsCount} part{m.partsCount === 1 ? '' : 's'}</span>}
                </div>
                <AddToCartButtons model={{ id: m.id, title: m.title, priceUsd: m.priceUsd, coverImagePath: m.coverImagePath, updatedAt: m.updatedAt, sizeXmm: m.sizeXmm, sizeYmm: m.sizeYmm, sizeZmm: m.sizeZmm }} />
                <div className="flex justify-between text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{m.priceUsd ? formatCurrency(m.priceUsd) : 'N/A'}</span>
                    {m.saleActive && m.basePriceUsd && (
                      <span className="text-xs text-slate-500 line-through">{formatCurrency(m.basePriceUsd)}</span>
                    )}
                  </div>
                  <span>{m.sizeXmm && m.sizeYmm && m.sizeZmm ? `${Math.round(m.sizeXmm)} x ${Math.round(m.sizeYmm)} x ${Math.round(m.sizeZmm)} mm` : 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Likes: {m.likes}</span>
                  <span>Downloads: {m.downloads}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </section>

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
