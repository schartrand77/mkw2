export type CommandPaletteAction = {
  id: string
  label: string
  description: string
  href: string
  keywords: string[]
  adminOnly?: boolean
}

export type CommandPaletteContext = {
  authed: boolean
  isAdmin: boolean
  cartCount: number
  pathname?: string
}

const BASE_ACTIONS: CommandPaletteAction[] = [
  {
    id: 'discover',
    label: 'Discover models',
    description: 'Browse the public model library and curated collections.',
    href: '/discover',
    keywords: ['discover', 'browse', 'models', 'library', 'search'],
  },
  {
    id: 'store',
    label: 'Open store',
    description: 'Shop configured products, kits, and merch.',
    href: '/products',
    keywords: ['store', 'products', 'shop', 'merch', 'catalog'],
  },
]

const AUTHED_ACTIONS: CommandPaletteAction[] = [
  {
    id: 'upload',
    label: 'Upload a model',
    description: 'Start a new model upload and quoting flow.',
    href: '/upload',
    keywords: ['upload', 'new model', 'quote', 'submit'],
  },
  {
    id: 'cart',
    label: 'Open cart',
    description: 'Review configured items before checkout.',
    href: '/cart',
    keywords: ['cart', 'basket', 'checkout'],
  },
  {
    id: 'checkout',
    label: 'Go to checkout',
    description: 'Move directly into payment and order confirmation.',
    href: '/checkout',
    keywords: ['checkout', 'payment', 'order'],
  },
  {
    id: 'orders',
    label: 'View orders',
    description: 'Check customer order history and status updates.',
    href: '/customer/orders',
    keywords: ['orders', 'history', 'tracking', 'status'],
  },
  {
    id: 'workspaces',
    label: 'Open workspaces',
    description: 'Jump into customer workspaces and organization projects.',
    href: '/customer/workspaces',
    keywords: ['workspaces', 'projects', 'organizations', 'teams'],
  },
  {
    id: 'portal',
    label: 'Open customer portal',
    description: 'See approvals, activity, and organization access in one place.',
    href: '/customer/portal',
    keywords: ['portal', 'customer', 'approvals', 'activity'],
  },
  {
    id: 'profile',
    label: 'Edit profile',
    description: 'Manage your public profile, avatar, and creator settings.',
    href: '/settings/profile',
    keywords: ['profile', 'settings', 'account', 'avatar'],
  },
  {
    id: 'account',
    label: 'Account settings',
    description: 'Manage security, privacy, and account-level preferences.',
    href: '/settings/account',
    keywords: ['account', 'security', 'privacy', 'settings'],
  },
]

const ADMIN_ACTIONS: CommandPaletteAction[] = [
  {
    id: 'admin-overview',
    label: 'Admin overview',
    description: 'Open the main operations and health dashboard.',
    href: '/admin',
    keywords: ['admin', 'overview', 'operations', 'dashboard'],
    adminOnly: true,
  },
  {
    id: 'admin-production',
    label: 'Production board',
    description: 'Jump into printer assignments and production handling.',
    href: '/admin/production',
    keywords: ['admin', 'production', 'printers', 'queue', 'jobs'],
    adminOnly: true,
  },
  {
    id: 'admin-jobs',
    label: 'Job queue',
    description: 'Inspect and manage queued job execution.',
    href: '/admin/jobs',
    keywords: ['admin', 'jobs', 'queue', 'printlab'],
    adminOnly: true,
  },
  {
    id: 'admin-inventory',
    label: 'Inventory',
    description: 'View stock levels, spools, and material warnings.',
    href: '/admin/inventory',
    keywords: ['admin', 'inventory', 'stock', 'materials', 'spools'],
    adminOnly: true,
  },
  {
    id: 'admin-analytics',
    label: 'Analytics',
    description: 'Open analytics, throughput, and business reporting.',
    href: '/admin/analytics',
    keywords: ['admin', 'analytics', 'reporting', 'metrics'],
    adminOnly: true,
  },
  {
    id: 'admin-users',
    label: 'User management',
    description: 'Review users, roles, discounts, and account controls.',
    href: '/admin/users',
    keywords: ['admin', 'users', 'roles', 'permissions'],
    adminOnly: true,
  },
]

export type PaletteRouteResolution = {
  navRoute: string | null
  discoverQuery: string
}

export function resolvePaletteRoute(rawQuery: string): PaletteRouteResolution {
  const query = rawQuery.trim()
  const tokens = query.split(/\s+/).filter(Boolean)
  const navTags = new Set<string>()
  const contentTokens: string[] = []

  for (const token of tokens) {
    if (token.startsWith('#')) navTags.add(token.toLowerCase().replace(/^#+/, ''))
    else contentTokens.push(token)
  }

  const routeByTag: Record<string, string> = {
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
    admin: '/admin',
    users: '/admin/users',
    jobs: '/admin/jobs',
    inventory: '/admin/inventory',
    analytics: '/admin/analytics',
    production: '/admin/production',
    models: '/discover',
    merch: '/discover',
    products: '/discover',
  }

  const preferredNavOrder = [
    'home', 'discover', 'models', 'merch', 'products', 'store', 'upload', 'cart', 'checkout', 'orders', 'portal', 'workspace',
    'workspaces', 'profile', 'account', 'orgs', 'organizations', 'likes', 'me', 'admin', 'users', 'jobs', 'inventory',
    'analytics', 'production',
  ]

  const navTag = preferredNavOrder.find((tag) => navTags.has(tag))
  const navRoute = navTag ? routeByTag[navTag] : null
  const discoverQuery = [
    contentTokens.join(' ').trim(),
    ...Array.from(navTags)
      .filter((tag) => ['models', 'merch', 'products'].includes(tag))
      .map((tag) => `#${tag}`),
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

  return { navRoute, discoverQuery }
}

export function getCommandPaletteActions(context: CommandPaletteContext): CommandPaletteAction[] {
  const actions = [...BASE_ACTIONS]

  if (context.authed) {
    actions.push(
      ...AUTHED_ACTIONS.map((action) => (
        action.id === 'cart'
          ? {
            ...action,
            description: context.cartCount > 0
              ? `Review ${context.cartCount} item${context.cartCount === 1 ? '' : 's'} before checkout.`
              : action.description,
          }
          : action
      )),
    )
  }

  if (context.isAdmin) actions.push(...ADMIN_ACTIONS)

  return actions
}

function includesToken(haystack: string, token: string): boolean {
  return haystack.includes(token)
}

export function filterCommandPaletteActions(rawQuery: string, actions: CommandPaletteAction[]): CommandPaletteAction[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return actions

  const routeResolution = resolvePaletteRoute(query)
  const tokens = query.split(/\s+/).filter(Boolean)

  return [...actions]
    .map((action) => {
      let score = action.href === routeResolution.navRoute ? 120 : 0
      const label = action.label.toLowerCase()
      const description = action.description.toLowerCase()
      const keywordBlob = action.keywords.join(' ').toLowerCase()
      const href = action.href.toLowerCase()

      for (const token of tokens) {
        if (includesToken(label, token)) score += 50
        if (action.id.includes(token)) score += 35
        if (includesToken(keywordBlob, token)) score += 25
        if (includesToken(description, token)) score += 10
        if (includesToken(href, token)) score += 8
      }

      return { action, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.action.label.localeCompare(b.action.label))
    .map((entry) => entry.action)
}
