'use client'

import Link from 'next/link'
import { useCallback } from 'react'
import { PROFILE_MODELS_VIEW_COOKIE, type ProfileModelsViewMode } from '@/lib/profile-models-view'

type Props = {
  viewMode: ProfileModelsViewMode
  gridHref: string
  compactHref: string
}

export default function ProfileModelsViewToggle({ viewMode, gridHref, compactHref }: Props) {
  const setPreference = useCallback((nextView: ProfileModelsViewMode) => {
    if (typeof document === 'undefined') return
    const maxAge = 60 * 60 * 24 * 365
    document.cookie = `${PROFILE_MODELS_VIEW_COOKIE}=${nextView}; path=/; max-age=${maxAge}`
  }, [])

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-xs uppercase tracking-[0.3em] text-slate-500">View</span>
      <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
        <Link
          href={gridHref}
          onClick={() => setPreference('grid')}
          className={`px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
          aria-pressed={viewMode === 'grid'}
        >
          Gallery
        </Link>
        <Link
          href={compactHref}
          onClick={() => setPreference('compact')}
          className={`px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${viewMode === 'compact' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
          aria-pressed={viewMode === 'compact'}
        >
          Compact
        </Link>
      </div>
    </div>
  )
}
