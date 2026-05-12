type QuickSearchOptions = {
  isAdmin: boolean
}

type QuickSearchResult = {
  navRoute: string | null
  discoverQuery: string
  adminOnly: boolean
}

const PUBLIC_ROUTE_BY_TAG: Record<string, string> = {
  home: '/',
  discover: '/discover',
  store: '/products',
  upload: '/upload',
  cart: '/cart',
  checkout: '/checkout',
  orders: '/customer/orders',
  portal: '/customer/portal',
  workspace: '/customer/workspaces',
  workspaces: '/customer/workspaces',
  profile: '/settings/profile',
  account: '/settings/account',
  orgs: '/settings/organizations',
  organizations: '/settings/organizations',
  likes: '/likes',
  me: '/me',
}

const ADMIN_ROUTE_BY_TAG: Record<string, string> = {
  admin: '/admin',
  setup: '/admin/suite-setup',
  suite: '/admin/suite-setup',
  users: '/admin/users',
  jobs: '/admin/jobs',
  orders: '/admin/jobs',
  inventory: '/admin/inventory',
  analytics: '/admin/analytics',
  production: '/admin/production',
  models: '/admin/models',
  model: '/admin/models',
  products: '/admin/products',
  product: '/admin/products',
  catalog: '/admin/catalog',
  merch: '/admin/catalog',
  featured: '/admin/featured',
  comments: '/admin/home-comments',
  queues: '/admin/processing-queues',
  backups: '/admin/backup-tools',
  config: '/admin/site-config',
}

const PUBLIC_DISCOVER_SCOPE_TAGS = new Set(['models', 'model', 'merch', 'products', 'product'])

const PUBLIC_NAV_ORDER = [
  'home',
  'discover',
  'store',
  'upload',
  'cart',
  'checkout',
  'orders',
  'portal',
  'workspace',
  'workspaces',
  'profile',
  'account',
  'orgs',
  'organizations',
  'likes',
  'me',
]

const ADMIN_NAV_ORDER = [
  'admin',
  'setup',
  'suite',
  'users',
  'jobs',
  'orders',
  'inventory',
  'analytics',
  'production',
  'models',
  'model',
  'products',
  'product',
  'catalog',
  'merch',
  'featured',
  'comments',
  'queues',
  'backups',
  'config',
]

function appendQuery(route: string, query: string) {
  if (!query) return route
  const params = new URLSearchParams({ q: query })
  return `${route}?${params.toString()}`
}

export function resolveQuickSearchNavigation(rawQuery: string, options: QuickSearchOptions): QuickSearchResult {
  const query = rawQuery.trim()
  const tokens = query.split(/\s+/).filter(Boolean)
  const navTags = new Set<string>()
  const contentTokens: string[] = []

  for (const token of tokens) {
    if (token.startsWith('#')) navTags.add(token.toLowerCase().replace(/^#+/, ''))
    else contentTokens.push(token)
  }

  const contentQuery = contentTokens.join(' ').trim()
  const adminTag = ADMIN_NAV_ORDER.find((tag) => {
    if (!navTags.has(tag)) return false
    if (!options.isAdmin && PUBLIC_ROUTE_BY_TAG[tag]) return false
    return options.isAdmin || !PUBLIC_DISCOVER_SCOPE_TAGS.has(tag)
  })
  if (adminTag) {
    const route = appendQuery(ADMIN_ROUTE_BY_TAG[adminTag], contentQuery)
    return { navRoute: route, discoverQuery: '', adminOnly: true }
  }

  const publicTag = PUBLIC_NAV_ORDER.find((tag) => navTags.has(tag))
  if (publicTag) {
    return {
      navRoute: PUBLIC_ROUTE_BY_TAG[publicTag],
      discoverQuery: '',
      adminOnly: false,
    }
  }

  const discoverQuery = [
    contentQuery,
    ...Array.from(navTags)
      .filter((tag) => PUBLIC_DISCOVER_SCOPE_TAGS.has(tag))
      .map((tag) => `#${tag}`),
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

  return { navRoute: null, discoverQuery, adminOnly: false }
}
