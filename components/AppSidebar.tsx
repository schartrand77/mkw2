"use client"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from '@/components/cart/CartProvider'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BRAND_FULL_NAME, BRAND_LOGO_PREFIX, BRAND_LOGO_SUFFIX, BRAND_VERSION } from '@/lib/brand'

type Props = {
  authed: boolean
  isAdmin: boolean
  avatarUrl: string | null
}

type AdminNavItem = {
  href: string
  label: string
  matchPrefixes?: string[]
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/site-config', label: 'Site config' },
  { href: '/admin/notifications', label: 'Notifications' },
  { href: '/admin/featured', label: 'Featured models' },
  { href: '/admin/home-comments', label: 'Home comments' },
  { href: '/admin/backup-tools', label: 'Backups & restore' },
  { href: '/admin/models', label: 'Model library', matchPrefixes: ['/admin/models/'] },
  { href: '/admin/products', label: 'Product builder' },
  { href: '/admin/catalog', label: 'Catalog manager' },
  { href: '/admin/production', label: 'Production' },
  { href: '/admin/jobs', label: 'Job queue' },
  { href: '/admin/processing-queues', label: 'Processing queues' },
  { href: '/admin/users', label: 'Users', matchPrefixes: ['/admin/users/'] },
  { href: '/admin/inventory', label: 'Inventory' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/material-optimization', label: 'Material optimization' },
  { href: '/admin/fleet-intelligence', label: 'Fleet intelligence' },
  { href: '/admin/batch-optimization', label: 'Batch optimization' },
  { href: '/admin/failure-photos', label: 'Failure photos' },
  { href: '/admin/demand-forecasting', label: 'Demand forecasting' },
]

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  if (href === '/me') return pathname.startsWith('/u') || pathname === '/me'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isActiveAdminPath(pathname: string, item: AdminNavItem): boolean {
  if (isActivePath(pathname, item.href)) return true
  return (item.matchPrefixes || []).some((prefix) => pathname.startsWith(prefix))
}

function GearGlyph() {
  return (
    <span className="block text-lg md:text-xl leading-none" aria-hidden="true">
      ⚙️
    </span>
  )
}

export default function AppSidebar({ authed, isAdmin, avatarUrl }: Props) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [mobileAdminOpen, setMobileAdminOpen] = useState(false)
  const [quickMenuOpen, setQuickMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(avatarUrl)
  const [quickSearch, setQuickSearch] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)
  const quickMenuRef = useRef<HTMLDivElement | null>(null)
  const mobileNavRef = useRef<HTMLDivElement | null>(null)
  const hamburgerRef = useRef<HTMLButtonElement | null>(null)
  const { count } = useCart()
  const inAdmin = pathname.startsWith('/admin')
  const desktopSidebarOpen = !desktopCollapsed

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.remove('sidebar-open')
    return () => {
      document.body.classList.remove('sidebar-open')
    }
  }, [])

  // Always close the mobile menu after navigation.
  useEffect(() => {
    if (isMobileViewport) setMobileNavOpen(false)
  }, [isMobileViewport, pathname])

  // If viewport is desktop, ensure mobile menu state is reset.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const widthMq = window.matchMedia('(max-width: 1023px)')
    const coarseMq = window.matchMedia('(pointer: coarse)')
    const handleChange = () => {
      const nextMobile = widthMq.matches && coarseMq.matches
      setIsMobileViewport(nextMobile)
      if (!nextMobile) setMobileNavOpen(false)
    }
    handleChange()
    widthMq.addEventListener('change', handleChange)
    coarseMq.addEventListener('change', handleChange)
    return () => {
      widthMq.removeEventListener('change', handleChange)
      coarseMq.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    if (inAdmin) setAdminOpen(true)
  }, [inAdmin])

  useEffect(() => {
    if (inAdmin) setMobileAdminOpen(true)
  }, [inAdmin])

  const logout = async () => {
    let redirectTarget = '/signed-out'
    try {
      const res = await fetch('/api/logout', { method: 'POST', credentials: 'include' })
      const contentType = res.headers.get('content-type') || ''
      if (res.ok && contentType.includes('application/json')) {
        try {
          const data = await res.json()
          if (typeof data?.redirect === 'string') redirectTarget = data.redirect
        } catch {}
      }
    } catch {}
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('mwv2:avatarUrl')
      } catch {}
      window.dispatchEvent(new CustomEvent('mwv2:avatar:update', { detail: '' }))
    }
    setAvatarSrc(null)
    pushSessionNotification({ type: 'info', title: 'Signed out', message: 'Come back soon!' })
    setMenuOpen(false)
    if (typeof window !== 'undefined') {
      window.location.href = redirectTarget
    } else {
      router.replace(redirectTarget)
    }
  }

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false)
      if (quickMenuRef.current && !quickMenuRef.current.contains(target)) setQuickMenuOpen(false)
      if (
        mobileNavRef.current &&
        !mobileNavRef.current.contains(target) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(target)
      ) {
        setMobileNavOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('mwv2:theme') as 'light' | 'dark' | null
    if (saved === 'light') setTheme('light')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      setDesktopCollapsed(localStorage.getItem('mwv2:sidebarCollapsed') === '1')
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('mwv2:sidebarCollapsed', desktopCollapsed ? '1' : '0')
    } catch {}
  }, [desktopCollapsed])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const body = document.body
    if (theme === 'light') {
      root.classList.add('theme-light')
      body?.classList.add('theme-light')
      root.classList.remove('theme-dark')
      body?.classList.remove('theme-dark')
    } else {
      root.classList.add('theme-dark')
      body?.classList.add('theme-dark')
      root.classList.remove('theme-light')
      body?.classList.remove('theme-light')
    }
    try {
      localStorage.setItem('mwv2:theme', theme)
    } catch {}
  }, [theme])

  useEffect(() => {
    setAvatarSrc(avatarUrl || null)
  }, [avatarUrl])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storageKey = 'mwv2:avatarUrl'
    const eventName = 'mwv2:avatar:update'
    try {
      const existing = localStorage.getItem(storageKey)
      if (existing) setAvatarSrc(existing)
    } catch {}
    const onAvatarUpdate = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (typeof detail === 'string' && detail.length) {
        setAvatarSrc(detail)
      } else {
        try {
          const fallback = localStorage.getItem(storageKey)
          setAvatarSrc(fallback || null)
        } catch {}
      }
    }
    window.addEventListener(eventName, onAvatarUpdate as EventListener)
    return () => window.removeEventListener(eventName, onAvatarUpdate as EventListener)
  }, [])

  const navLinkCls = (href: string) => {
    const active = isActivePath(pathname, href)
    return active
      ? 'app-sidebar-link app-sidebar-link-active'
      : 'app-sidebar-link'
  }

  const adminToggle = () => {
    setAdminOpen((open) => !open)
    if (!inAdmin) {
      router.push('/admin')
    }
  }

  const toggleSidebar = () => {
    if (isMobileViewport) {
      setMobileNavOpen((open) => !open)
      return
    }
    setDesktopCollapsed((collapsed) => !collapsed)
  }

  const closeMenus = () => {
    setMenuOpen(false)
    setQuickMenuOpen(false)
    setMobileNavOpen(false)
    setMobileAdminOpen(false)
  }

  const renderAccountMenu = (className: string) => (
    <div role="menu" className={className}>
      {isAdmin && <Link href="/admin" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Admin</Link>}
      <Link href="/settings/profile" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Edit Profile</Link>
      <Link href="/me" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">My Page</Link>
      <Link href="/customer/portal" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Customer Portal</Link>
      <Link href="/customer/orders" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Orders</Link>
      <Link href="/settings/organizations" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Organizations</Link>
      <Link href="/settings/account" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Account</Link>
      <button type="button" role="menuitem" onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))} className="app-sidebar-menu-item w-full text-left">
        {theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
      </button>
      <button role="menuitem" onClick={logout} className="app-sidebar-menu-item w-full text-left">Sign out</button>
    </div>
  )

  const resolveQuickSearchNavigation = (rawQuery: string) => {
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
    }

    const preferredNavOrder = [
      'home', 'discover', 'store', 'upload', 'cart', 'checkout', 'orders', 'portal', 'profile',
      'account', 'orgs', 'organizations', 'likes', 'me', 'admin', 'users', 'jobs', 'inventory', 'analytics', 'production',
    ]
    const navTag = preferredNavOrder.find((tag) => navTags.has(tag))
    const navRoute = navTag ? routeByTag[navTag] : null
    const discoverQuery = [contentTokens.join(' ').trim(), ...Array.from(navTags).filter((tag) => ['models', 'merch', 'products'].includes(tag)).map((tag) => `#${tag}`)]
      .filter(Boolean)
      .join(' ')
      .trim()

    return { navRoute, discoverQuery }
  }

  const handleQuickSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const raw = quickSearch.trim()
    if (!raw) {
      router.push('/discover')
      return
    }
    const { navRoute, discoverQuery } = resolveQuickSearchNavigation(raw)

    if (navRoute?.startsWith('/admin') && !isAdmin) {
      pushSessionNotification({ type: 'error', title: 'Admin only', message: 'That hashtag route requires admin access.' })
      return
    }
    if (navRoute && navRoute !== '/discover') {
      router.push(navRoute)
      return
    }
    const qs = new URLSearchParams()
    if (discoverQuery) qs.set('q', discoverQuery)
    const href = `/discover${qs.toString() ? `?${qs.toString()}` : ''}`
    router.push(href)
  }

  return (
    <>
      {mounted && createPortal(
        <button
          ref={hamburgerRef}
          type="button"
          className="app-hamburger-shortcut"
          onClick={toggleSidebar}
          aria-expanded={isMobileViewport ? mobileNavOpen : desktopSidebarOpen}
          aria-controls={isMobileViewport ? 'app-mobile-nav-menu' : 'app-sidebar'}
          aria-label={isMobileViewport ? 'Toggle navigation menu' : (desktopSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar')}
        >
          <span aria-hidden="true">☰</span>
        </button>,
        document.body
      )}

      {mounted && createPortal(
        <Link
          href="/"
          aria-label={BRAND_FULL_NAME}
          className="app-home-shortcut"
        >
          <span>{BRAND_LOGO_PREFIX}</span>
          <span className="inline-block align-baseline text-brand-500 gear app-brand-gear-tight" aria-hidden="true" style={{ animationDelay: '800ms', animationDuration: '1200ms' }}>
            <GearGlyph />
          </span>
          {BRAND_LOGO_SUFFIX && <span>{BRAND_LOGO_SUFFIX}</span>}
          {BRAND_VERSION && <span className="text-brand-500"> {BRAND_VERSION}</span>}
        </Link>,
        document.body
      )}

      {authed && mounted && createPortal(
        <div className={`app-user-shortcut ${!isMobileViewport && desktopSidebarOpen ? 'app-user-shortcut-open' : ''}`} ref={quickMenuRef}>
          <div className="app-user-shortcut-row">
            <form className="app-user-search-form" onSubmit={handleQuickSearchSubmit}>
              <input
                className="app-user-search-input"
                type="search"
                name="quickSearch"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Search... (#discover #store #upload)"
                aria-label="Search and navigate"
              />
            </form>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={quickMenuOpen}
              onClick={() => setQuickMenuOpen((open) => !open)}
              className={`app-sidebar-profile ${isActivePath(pathname, '/me') ? 'app-sidebar-profile-active' : ''}`}
              aria-label="Open account menu"
            >
              {avatarSrc ? <img src={avatarSrc} alt="Avatar" className="h-8 w-8 rounded-full border border-white/10 object-cover" /> : <span>Me</span>}
            </button>
          </div>
          {quickMenuOpen && renderAccountMenu('app-sidebar-menu app-user-shortcut-menu')}
        </div>,
        document.body
      )}

      {mounted && createPortal(
        isMobileViewport && mobileNavOpen ? (
          <div id="app-mobile-nav-menu" ref={mobileNavRef} role="menu" className="app-sidebar-menu app-mobile-nav-menu">
            <Link href="/discover" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Discover</Link>
            <Link href="/products" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Store</Link>
            {authed ? (
              <>
                <Link href="/upload" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Upload</Link>
                <Link href="/cart" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Cart{count > 0 ? ` (${count})` : ''}</Link>
                <Link href="/checkout" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Checkout</Link>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      aria-expanded={mobileAdminOpen}
                      onClick={() => setMobileAdminOpen((open) => !open)}
                      className="app-sidebar-menu-item w-full text-left"
                    >
                      Admin {mobileAdminOpen ? '▾' : '▸'}
                    </button>
                    {mobileAdminOpen && (
                      <div className="pl-2 pb-1">
                        {ADMIN_NAV_ITEMS.map((item) => {
                          const active = isActiveAdminPath(pathname, item)
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              role="menuitem"
                              onClick={closeMenus}
                              className={`app-sidebar-menu-item ${active ? 'app-sidebar-sub-link-active' : ''}`}
                            >
                              {item.label}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
                <Link href="/me" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">My Page</Link>
                <Link href="/customer/orders" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Orders</Link>
                <Link href="/settings/profile" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Edit Profile</Link>
                <button type="button" role="menuitem" onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))} className="app-sidebar-menu-item w-full text-left">
                  {theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                </button>
                <button type="button" role="menuitem" onClick={logout} className="app-sidebar-menu-item w-full text-left">Sign out</button>
              </>
            ) : (
              <>
                <Link href="/login" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Sign in</Link>
                <Link href="/register" role="menuitem" onClick={closeMenus} className="app-sidebar-menu-item">Join</Link>
              </>
            )}
          </div>
        ) : null,
        document.body
      )}

      <aside
        id="app-sidebar"
        className={`app-sidebar ${desktopCollapsed ? 'app-sidebar-collapsed' : ''} ${!isMobileViewport && desktopSidebarOpen ? 'app-sidebar-open' : ''}`}
        style={isMobileViewport ? { display: 'none' } : undefined}
      >
        <div className="app-sidebar-inner">
          <nav className="space-y-1" aria-label="Main navigation">
            <Link href="/discover" className={navLinkCls('/discover')}>Discover</Link>
            <Link href="/products" className={navLinkCls('/products')}>Store</Link>
            {authed && (
              <>
                <Link href="/upload" className={navLinkCls('/upload')}>Upload</Link>
                <Link href="/cart" className={navLinkCls('/cart')}>Cart{count > 0 ? ` (${count})` : ''}</Link>
                <Link href="/checkout" className={navLinkCls('/checkout')}>Checkout</Link>
                {isAdmin && (
                  <>
                    <button type="button" className={navLinkCls('/admin')} onClick={adminToggle} aria-expanded={adminOpen}>
                      <span>Admin</span>
                    </button>
                    {adminOpen && (
                      <div className="app-sidebar-admin-list" aria-label="Admin navigation">
                        {ADMIN_NAV_ITEMS.map((item) => {
                          const active = isActiveAdminPath(pathname, item)
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`app-sidebar-sub-link ${active ? 'app-sidebar-sub-link-active' : ''}`}
                              aria-current={active ? 'page' : undefined}
                            >
                              {item.label}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {!authed && (
              <>
                <Link href="/login" className={navLinkCls('/login')}>Sign in</Link>
                <Link href="/register" className={navLinkCls('/register')}>Join</Link>
              </>
            )}
          </nav>

          {authed && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                  className={`app-sidebar-profile ${isActivePath(pathname, '/me') ? 'app-sidebar-profile-active' : ''}`}
                >
                  {avatarSrc ? <img src={avatarSrc} alt="Avatar" className="h-8 w-8 rounded-full border border-white/10 object-cover" /> : <span>Me</span>}
                </button>
                {menuOpen && renderAccountMenu('app-sidebar-menu')}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

