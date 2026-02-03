'use client'

import { useEffect, useRef, useState } from 'react'
import { DiscoverSort, DiscoverViewMode } from '@/types/discover'

const PAGE_SIZE_OPTIONS = [12, 24, 36, 48, 60]

type DiscoverFiltersProps = {
  q: string
  sort: string
  pageSize: number
  viewMode: DiscoverViewMode
}

export default function DiscoverFilters({ q, sort, pageSize, viewMode }: DiscoverFiltersProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  return (
    <form method="get" className="space-y-3">
      {open && <div className="fixed inset-0 z-30 discover-search-backdrop" aria-hidden="true" />}
      <div
        ref={containerRef}
        className={`relative mx-auto w-full max-w-xl transition-all duration-300 ${open ? 'fixed left-0 right-0 top-4 z-40 max-w-none px-3' : ''}`}
      >
        <div
          className={`flex flex-wrap items-center gap-2 rounded-2xl p-2 transition-all duration-300 discover-search-shell ${open ? 'px-4 py-3' : ''}`}
        >
          <input
            className={`flex-1 px-2 py-2 text-sm focus:outline-none discover-search-input ${open ? 'min-w-[220px]' : 'text-center'}`}
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search models..."
            onFocus={() => setOpen(true)}
          />
          <div className={`flex flex-wrap items-center gap-2 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-200`}>
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
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs discover-filter-chip"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
      <input type="hidden" name="page" value="1" />
      {viewMode === DiscoverViewMode.Compact && <input type="hidden" name="view" value={DiscoverViewMode.Compact} />}
    </form>
  )
}
