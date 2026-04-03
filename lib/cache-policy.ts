export const CACHE_TTL_SECONDS = {
  homePage: 120,
  featuredModels: 120,
  discoverModels: 90,
  modelDetail: 120,
  modelComments: 60,
  homeCuratedComments: 120,
  collections: 300,
} as const

export const CACHE_TAGS = {
  homePage: 'home-page',
  featuredModels: 'featured-models',
  discoverModels: 'discover-models',
  homeCuratedComments: 'home-curated-comments',
  collections: 'collections',
} as const

export function modelTag(modelId: string) {
  return `model:${modelId}`
}

export function modelCommentsTag(modelId: string) {
  return `model:${modelId}:comments`
}
