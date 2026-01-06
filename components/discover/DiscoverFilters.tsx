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

  return (
    <form method="get" className="space-y-3">
      <div className="relative mx-auto w-full max-w-xl" ref={containerRef}>
        <input
          className="input text-center"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search models..."
          onFocus={() => setOpen(true)}
        />
        {open && (
          <div className="absolute left-0 right-0 z-10 mt-2 rounded-md border border-white/10 bg-slate-950/95 p-3 shadow-lg backdrop-blur">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Sort</label>
                <select name="sort" defaultValue={sort} className="input py-1.5 text-sm">
                  <option value={DiscoverSort.Latest}>Latest</option>
                  <option value={DiscoverSort.Popular}>Popular</option>
                  <option value={DiscoverSort.PriceAsc}>Price: Low to High</option>
                  <option value={DiscoverSort.PriceDesc}>Price: High to Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Per page</label>
                <select name="pageSize" defaultValue={pageSize} className="input py-1.5 text-sm">
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button className="btn">Apply Filters</button>
              <button type="button" className="text-sm text-slate-400 hover:text-slate-200" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
      <input type="hidden" name="page" value="1" />
      {viewMode === DiscoverViewMode.Compact && <input type="hidden" name="view" value={DiscoverViewMode.Compact} />}
    </form>
  )
}
