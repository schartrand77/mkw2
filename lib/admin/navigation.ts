export type AdminNavItem = {
  href: string
  label: string
  matchPrefixes?: string[]
}

export type AdminNavSection = {
  title: string
  icon: 'core' | 'operations' | 'intelligence'
  items: AdminNavItem[]
}

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    title: 'Core',
    icon: 'core',
    items: [
      { href: '/admin', label: 'Overview' },
      { href: '/admin/site-config', label: 'Site config' },
      { href: '/admin/featured', label: 'Featured models' },
      { href: '/admin/backup-tools', label: 'Backups & restore' },
      { href: '/admin/models', label: 'Model library', matchPrefixes: ['/admin/models/'] },
      { href: '/admin/products', label: 'Product builder' },
    ],
  },
  {
    title: 'Operations',
    icon: 'operations',
    items: [
      { href: '/admin/production', label: 'Production' },
      { href: '/admin/jobs', label: 'Job queue' },
      { href: '/admin/users', label: 'Users', matchPrefixes: ['/admin/users/'] },
      { href: '/admin/inventory', label: 'Inventory' },
      { href: '/admin/analytics', label: 'Analytics' },
    ],
  },
  {
    title: 'Intelligence',
    icon: 'intelligence',
    items: [
      { href: '/admin/material-optimization', label: 'Material optimization' },
      { href: '/admin/fleet-intelligence', label: 'Fleet intelligence' },
      { href: '/admin/batch-optimization', label: 'Batch optimization' },
      { href: '/admin/failure-photos', label: 'Failure photos' },
      { href: '/admin/demand-forecasting', label: 'Demand forecasting' },
    ],
  },
]
