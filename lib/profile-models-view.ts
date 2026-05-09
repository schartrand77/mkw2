export const PROFILE_MODELS_VIEW_COOKIE = 'mwv2_profile_models_view'

export type ProfileModelsViewMode = 'grid' | 'compact'

export function resolveProfileModelsViewMode(
  requestedView?: string | null,
  storedView?: string | null,
): ProfileModelsViewMode {
  if (requestedView === 'compact') return 'compact'
  if (requestedView === 'grid') return 'grid'
  return storedView === 'compact' ? 'compact' : 'grid'
}

export function buildProfileModelsHref(slug: string, page: number, viewMode: ProfileModelsViewMode) {
  const params = new URLSearchParams()
  params.set('page', String(Math.max(1, page)))
  params.set('view', viewMode)
  return `/u/${encodeURIComponent(slug)}?${params.toString()}`
}
