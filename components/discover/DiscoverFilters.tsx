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
    <form method="get" className="grid md:grid-cols-4 gap-3 items-end">
      <div className="md:col-span-2">
        <label className="block text-sm mb-1">Search</label>
        <input className="input" type="search" name="q" defaultValue={q} placeholder="Search models..." />
      </div>
      <div>
        <label className="block text-sm mb-1">Sort</label>
        <select name="sort" defaultValue={sort} className="input">
          <option value={DiscoverSort.Latest}>Latest</option>
          <option value={DiscoverSort.Popular}>Popular</option>
          <option value={DiscoverSort.PriceAsc}>Price: Low to High</option>
          <option value={DiscoverSort.PriceDesc}>Price: High to Low</option>
        </select>
      </div>
      <div>
        <label className="block text-sm mb-1">Per page</label>
        <select name="pageSize" defaultValue={pageSize} className="input">
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>
      <input type="hidden" name="page" value="1" />
      {viewMode === DiscoverViewMode.Compact && <input type="hidden" name="view" value={DiscoverViewMode.Compact} />}
      <div className="md:col-span-3">
        <button className="btn">Apply Filters</button>
      </div>
    </form>
  )
}
