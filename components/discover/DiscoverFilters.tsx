'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DiscoverSort, DiscoverViewMode } from '@/types/discover'

const PAGE_SIZE_OPTIONS = [12, 24, 36, 48, 60]

type DiscoverFiltersProps = {
  q: string
  sort: string
  pageSize: number
  viewMode: DiscoverViewMode
  ready?: boolean
  suggestedMaterials?: string[]
  suggestedTags?: Array<{ name: string; slug: string }>
}

const SORT_EXPLAINERS: Record<string, string> = {
  [DiscoverSort.Latest]: 'Newest uploads first.',
  [DiscoverSort.Popular]: 'Prioritizes likes and downloads.',
  [DiscoverSort.BestConfidence]: 'Prioritizes easier-to-produce, lower-risk models.',
  [DiscoverSort.FastestToShip]: 'Prioritizes in-stock materials and lower-risk production.',
  [DiscoverSort.LowestFailureRisk]: 'Surfaces the safest prints first.',
  [DiscoverSort.PriceAsc]: 'Lowest estimated price first.',
  [DiscoverSort.PriceDesc]: 'Highest estimated price first.',
}

type ParsedSearch = {
  text: string
  scopes: string[]
  materials: string[]
  tags: string[]
}

function parseSearch(raw: string): ParsedSearch {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  const scopes = new Set<string>()
  const materials = new Set<string>()
  const tags = new Set<string>()
  const textTokens: string[] = []

  for (const token of tokens) {
    const normalized = token.toLowerCase()
    if (normalized.startsWith('material:')) {
      const value = token.slice(token.indexOf(':') + 1).trim()
      if (value) materials.add(value)
      continue
    }
    if (normalized.startsWith('tag:') || normalized.startsWith('tags:')) {
      const value = token.slice(token.indexOf(':') + 1).trim().replace(/^#+/, '')
      if (value) tags.add(value.toLowerCase())
      continue
    }
    if (normalized.startsWith('#')) {
      const scope = normalized.replace(/^#+/, '')
      if (['model', 'models', 'print', 'prints'].includes(scope)) {
        scopes.add('#models')
        continue
      }
      if (['product', 'products', 'template', 'templates'].includes(scope)) {
        scopes.add('#products')
        continue
      }
      if (['merch', 'apparel', 'swag'].includes(scope)) {
        scopes.add('#merch')
        continue
      }
    }
    textTokens.push(token)
  }

  return {
    text: textTokens.join(' ').trim(),
    scopes: Array.from(scopes),
    materials: Array.from(materials),
    tags: Array.from(tags),
  }
}

function buildSearchValue(parsed: ParsedSearch) {
  return [
    parsed.text,
    ...parsed.scopes,
    ...parsed.materials.map((value) => `material:${value}`),
    ...parsed.tags.map((value) => `tag:${value}`),
  ].filter(Boolean).join(' ').trim()
}

export default function DiscoverFilters({
  q,
  sort,
  pageSize,
  viewMode,
  ready,
  suggestedMaterials = [],
  suggestedTags = [],
}: DiscoverFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeSortDescription = SORT_EXPLAINERS[sort] || SORT_EXPLAINERS[DiscoverSort.Latest]
  const parsedSearch = useMemo(() => parseSearch(q), [q])

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = []
    const buildHref = (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (!value) next.delete(key)
        else next.set(key, value)
      }
      next.set('page', '1')
      return `${pathname}?${next.toString()}`
    }

    if (parsedSearch.text) {
      chips.push({
        key: 'q',
        label: `Search: ${parsedSearch.text}`,
        clear: () => router.push(buildHref({ q: buildSearchValue({ ...parsedSearch, text: '' }) || null })),
      })
    }
    parsedSearch.scopes.forEach((scope) => {
      chips.push({
        key: `scope:${scope}`,
        label: scope,
        clear: () => router.push(buildHref({ q: buildSearchValue({ ...parsedSearch, scopes: parsedSearch.scopes.filter((entry) => entry !== scope) }) || null })),
      })
    })
    parsedSearch.materials.forEach((material) => {
      chips.push({
        key: `material:${material}`,
        label: `Material: ${material}`,
        clear: () => router.push(buildHref({
          q: buildSearchValue({ ...parsedSearch, materials: parsedSearch.materials.filter((entry) => entry !== material) }) || null,
          material: null,
        })),
      })
    })
    parsedSearch.tags.forEach((tag) => {
      chips.push({
        key: `tag:${tag}`,
        label: `Tag: ${tag}`,
        clear: () => router.push(buildHref({
          q: buildSearchValue({ ...parsedSearch, tags: parsedSearch.tags.filter((entry) => entry !== tag) }) || null,
          tags: null,
        })),
      })
    })
    if (ready) {
      chips.push({
        key: 'ready',
        label: 'Ready to Print',
        clear: () => router.push(buildHref({ ready: null })),
      })
    }
    if (sort && sort !== DiscoverSort.Latest) {
      const label = sort === DiscoverSort.BestConfidence
        ? 'Best confidence'
        : sort === DiscoverSort.FastestToShip
          ? 'Fastest to ship'
          : sort === DiscoverSort.LowestFailureRisk
            ? 'Lowest failure risk'
            : sort === DiscoverSort.Popular
              ? 'Popular'
              : sort === DiscoverSort.PriceAsc
                ? 'Price: Low to High'
                : 'Price: High to Low'
      chips.push({
        key: 'sort',
        label,
        clear: () => router.push(buildHref({ sort: DiscoverSort.Latest })),
      })
    }
    return chips
  }, [parsedSearch, pathname, ready, router, searchParams, sort])

  const resetAll = () => {
    const next = new URLSearchParams()
    next.set('page', '1')
    next.set('pageSize', String(pageSize))
    if (viewMode === DiscoverViewMode.Compact) next.set('view', DiscoverViewMode.Compact)
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <form method="get" className="space-y-3">
      <div className="relative mx-auto w-full max-w-3xl transition-all duration-300">
        <div className="rounded-2xl p-3 transition-all duration-300 discover-search-shell space-y-3">
          <input type="hidden" name="q" value={q} />
          <datalist id="discover-search-suggestions">
            {suggestedMaterials.map((material) => (
              <option key={`material-${material}`} value={`material:${material.toLowerCase()}`} />
            ))}
            {suggestedTags.map((tag) => (
              <option key={`tag-${tag.slug}`} value={`tag:${tag.slug}`} />
            ))}
          </datalist>
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
              <option value={DiscoverSort.BestConfidence}>Best confidence</option>
              <option value={DiscoverSort.FastestToShip}>Fastest to ship</option>
              <option value={DiscoverSort.LowestFailureRisk}>Lowest failure risk</option>
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
            <label className={`rounded-full px-3 py-1.5 text-xs discover-filter-chip inline-flex items-center gap-2 ${ready ? 'border-white/30 text-white' : ''}`}>
              <input type="checkbox" name="ready" value="1" defaultChecked={ready} />
              Ready to Print
            </label>
            <button className="rounded-full px-3 py-1.5 text-xs discover-filter-chip">
              Apply
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
            <p className="text-slate-400">{activeSortDescription}</p>
            <p className="text-slate-500">Use the top-row search with <span className="text-slate-300">material:</span>, <span className="text-slate-300">tag:</span>, or <span className="text-slate-300">#products</span>.</p>
          </div>
          {(suggestedMaterials.length > 0 || suggestedTags.length > 0) && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              {suggestedMaterials.slice(0, 4).map((material) => (
                <button
                  key={material}
                  type="button"
                  onClick={() => router.push(`${pathname}?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), q: buildSearchValue({ ...parsedSearch, materials: Array.from(new Set([...parsedSearch.materials, material.toLowerCase()])), text: parsedSearch.text, scopes: parsedSearch.scopes, tags: parsedSearch.tags }), page: '1' }).toString()}`)}
                  className="rounded-full border border-white/10 px-3 py-1 text-slate-300 hover:border-white/20"
                >
                  material:{material.toLowerCase()}
                </button>
              ))}
              {suggestedTags.slice(0, 4).map((tag) => (
                <button
                  key={tag.slug}
                  type="button"
                  onClick={() => router.push(`${pathname}?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), q: buildSearchValue({ ...parsedSearch, tags: Array.from(new Set([...parsedSearch.tags, tag.slug])), text: parsedSearch.text, scopes: parsedSearch.scopes, materials: parsedSearch.materials }), page: '1' }).toString()}`)}
                  className="rounded-full border border-white/10 px-3 py-1 text-slate-300 hover:border-white/20"
                >
                  tag:{tag.slug}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-300 hover:border-white/20"
            >
              {chip.label} x
            </button>
          ))}
          <button
            type="button"
            onClick={resetAll}
            className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 hover:border-rose-400/40"
          >
            Clear all
          </button>
        </div>
      )}
      <input type="hidden" name="page" value="1" />
      {viewMode === DiscoverViewMode.Compact && <input type="hidden" name="view" value={DiscoverViewMode.Compact} />}
    </form>
  )
}
