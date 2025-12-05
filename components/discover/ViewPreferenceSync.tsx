'use client'

import { useEffect } from 'react'

type Props = {
  viewMode: 'grid' | 'compact'
  storedView: 'grid' | 'compact'
}

export default function ViewPreferenceSync({ viewMode, storedView }: Props) {
  useEffect(() => {
    if (storedView === viewMode) return
    if (typeof document === 'undefined') return
    const maxAge = 60 * 60 * 24 * 365
    document.cookie = `mwv2_discover_view=${viewMode}; path=/; max-age=${maxAge}`
  }, [storedView, viewMode])

  return null
}
