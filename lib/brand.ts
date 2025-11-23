function readEnv(key: string): string | undefined {
  if (typeof process === 'undefined') return undefined
  if (!(key in process.env)) return undefined
  return (process.env[key] || '').trim()
}

function resolveEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const val = readEnv(key)
    if (val !== undefined) {
      return val
    }
  }
  return undefined
}

const DEFAULT_BRAND_NAME = 'MakerWorks'
const DEFAULT_BRAND_VERSION = 'v2'

const resolvedBrandName = resolveEnv(['BRAND_NAME', 'NEXT_PUBLIC_BRAND_NAME'])
export const BRAND_NAME = resolvedBrandName && resolvedBrandName.length > 0 ? resolvedBrandName : DEFAULT_BRAND_NAME

const resolvedBrandVersion = resolveEnv(['BRAND_VERSION', 'NEXT_PUBLIC_BRAND_VERSION'])
export const BRAND_VERSION = resolvedBrandVersion !== undefined ? resolvedBrandVersion : DEFAULT_BRAND_VERSION

const resolvedLabName = resolveEnv(['BRAND_LAB_NAME', 'NEXT_PUBLIC_BRAND_LAB_NAME'])
export const BRAND_LAB_NAME = resolvedLabName && resolvedLabName.length > 0 ? resolvedLabName : `${BRAND_NAME} lab`

const slug = BRAND_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
export const BRAND_SLUG = slug || 'makerworks'

const normalizedHandleBase = BRAND_SLUG.replace(/-/g, '')
const handleDefault = normalizedHandleBase ? `@${normalizedHandleBase}` : '@makers'
const resolvedHandle = resolveEnv(['BRAND_HANDLE', 'NEXT_PUBLIC_BRAND_HANDLE'])
export const BRAND_HANDLE = resolvedHandle && resolvedHandle.length > 0 ? resolvedHandle : handleDefault

export const BRAND_FULL_NAME = BRAND_VERSION ? `${BRAND_NAME} ${BRAND_VERSION}`.trim() : BRAND_NAME
