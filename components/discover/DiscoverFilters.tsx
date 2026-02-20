'use client'

import { DiscoverSort, DiscoverViewMode } from '@/types/discover'

const PAGE_SIZE_OPTIONS = [12, 24, 36, 48, 60]

type DiscoverFiltersProps = {
  q: string
  sort: string
  pageSize: number
  viewMode: DiscoverViewMode
}

export default function DiscoverFilters({ q, sort, pageSize, viewMode }: DiscoverFiltersProps) {
  return (
    <form method="get" className="space-y-3">
      <div className="relative mx-auto w-full max-w-xl transition-all duration-300">
        <div
          className="flex flex-wrap items-center gap-2 rounded-2xl p-2 px-4 py-3 transition-all duration-300 discover-search-shell"
        >
          <input
            className="flex-1 min-w-[220px] px-2 py-2 text-sm focus:outline-none discover-search-input"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search models..."
          />
          <div className="flex flex-wrap items-center gap-2 transition-opacity duration-200">
            <label className="sr-only" htmlFor="discover-sort">Sort</label>
            <select
              id="discover-sort"
              name="sort"
              defaultValue={sort}
              className="rounded-full px-3 py-1.5 text-xs focus:outline-none discover-filter-chip"
            >
              <option value={DiscoverSort.Latest}>Latest</option>
              <option value={DiscoverSort.Popular}>Popular</option>
              <option value={DiscoverSort.PriceAsc}>Price: Low to High</option>
              <option value={DiscoverSort.PriceDesc}>Price: High to Low</option>
            </select>
            <label className="sr-only" htmlFor="discover-page-size">Per page</label>
            <select
              id="discover-page-size"
              name="pageSize"
              defaultValue={pageSize}
              className="rounded-full px-3 py-1.5 text-xs focus:outline-none discover-filter-chip"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>
            <button className="rounded-full px-3 py-1.5 text-xs discover-filter-chip">
              Apply
            </button>
          </div>
        </div>
      </div>
      <input type="hidden" name="page" value="1" />
      {viewMode === DiscoverViewMode.Compact && <input type="hidden" name="view" value={DiscoverViewMode.Compact} />}
    </form>
  )
}
