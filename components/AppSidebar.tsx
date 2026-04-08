"use client"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from '@/components/cart/CartProvider'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BRAND_FULL_NAME, BRAND_LOGO_PREFIX, BRAND_LOGO_SUFFIX, BRAND_VERSION } from '@/lib/brand'
import CommandPalette from '@/components/CommandPalette'

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

type ThemeMode = 'light' | 'dark' | 'oled'

const PRIMARY_LINKS = [
  { href: '/discover', label: 'Discover' },
  { href: '/products', label: 'Store' },
]

const AUTHED_LINKS = [
  { href: '/upload', label: 'Upload' },
  { href: '/checkout', label: 'Checkout' },
]

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
  { href: '/admin/governance', label: 'Governance' },
  { href: '/admin/connectors', label: 'Connectors' },
  { href: '/admin/webhooks', label: 'Webhook & API ops' },
  { href: '/admin/release-health', label: 'Release health' },
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

function getThemeLabel(theme: ThemeMode): string {
  if (theme === 'light') return 'Light'
  if (theme === 'dark') return 'Dark'
  return 'OLED black'
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  if (href === '/me') return pathname.startsWith('/u') || pathname === '/me'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isActiveAdminPath(pathname: string, item: AdminNavItem): boolean {
  if (item.href === '/admin') return pathname === '/admin'
  if (isActivePath(pathname, item.href)) return true
  return (item.matchPrefixes || []).some((prefix) => pathname.startsWith(prefix))
}

function GearGlyph() {
  return (
    <span className="app-brand-mark" aria-hidden="true">
      <span className="app-brand-mark-gear">*</span>
    </span>
  )
}

export default function AppSidebar({ authed, isAdmin, avatarUrl }: Props) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const { count } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [mobileThemeMenuOpen, setMobileThemeMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [avatarSrc, setAvatarSrc] = useState<string | null>(avatarUrl)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null)
  const inAdmin = pathname.startsWith('/admin')

  const activeAdminLabel = useMemo(() => {
    const current = ADMIN_NAV_ITEMS.find((item) => isActiveAdminPath(pathname, item))
    return current?.label || 'Overview'
  }, [pathname])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('mwv2:theme') as ThemeMode | null
    if (saved === 'light' || saved === 'dark' || saved === 'oled') setTheme(saved)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const body = document.body
    const themeClasses = ['theme-light', 'theme-dark', 'theme-oled']
    root.classList.remove(...themeClasses)
    body.classList.remove(...themeClasses)
    root.classList.add(`theme-${theme}`)
    body.classList.add(`theme-${theme}`)
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
        return
      }
      try {
        setAvatarSrc(localStorage.getItem(storageKey) || null)
      } catch {
        setAvatarSrc(null)
      }
    }
    window.addEventListener(eventName, onAvatarUpdate as EventListener)
    return () => window.removeEventListener(eventName, onAvatarUpdate as EventListener)
  }, [])

  useEffect(() => {
    setMobileNavOpen(false)
    setCommandPaletteOpen(false)
  }, [pathname])

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false)
        setThemeMenuOpen(false)
      }
      if (mobileDrawerRef.current && !mobileDrawerRef.current.contains(target)) {
        const insideToggle = target instanceof HTMLElement && !!target.closest('[data-app-drawer-toggle="true"]')
        if (!insideToggle) {
          setMobileNavOpen(false)
          setMobileThemeMenuOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileNavOpen])

  const logout = async () => {
    let redirectTarget = '/signed-out'
    try {
      const res = await fetch('/api/logout', { method: 'POST', credentials: 'include' })
      if (!res.ok) {
        let message = 'Sign out failed. Please try again.'
        try {
          const contentType = res.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            const body = await res.json()
            if (typeof body?.error === 'string' && body.error.trim()) message = body.error
          } else {
            const text = await res.text()
            if (text.trim()) message = text.trim()
          }
        } catch {}
        pushSessionNotification({ type: 'error', title: 'Sign out failed', message })
        return
      }
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
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
    setMobileNavOpen(false)
    if (typeof window !== 'undefined') {
      window.location.href = redirectTarget
    } else {
      router.replace(redirectTarget)
    }
  }

  const closeMenus = () => {
    setMenuOpen(false)
    setThemeMenuOpen(false)
    setMobileNavOpen(false)
    setMobileThemeMenuOpen(false)
  }

  const renderThemeChoices = (mobile = false) => (
    <div className="app-theme-list">
      {(['light', 'dark', 'oled'] as ThemeMode[]).map((option) => {
        const active = theme === option
        return (
          <button
            key={option}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            onClick={() => {
              setTheme(option)
              if (mobile) setMobileThemeMenuOpen(false)
              else setThemeMenuOpen(false)
            }}
            className={`app-menu-item ${active ? 'app-menu-item-active' : ''}`}
          >
            {active ? '* ' : ''}{getThemeLabel(option)}
          </button>
        )
      })}
    </div>
  )

  const renderAccountMenu = (mobile = false) => (
    <div role="menu" className={mobile ? 'app-mobile-section' : 'app-menu-panel'}>
      {isAdmin && <Link href="/admin" role="menuitem" onClick={closeMenus} className="app-menu-item">Admin</Link>}
      <Link href="/settings/profile" role="menuitem" onClick={closeMenus} className="app-menu-item">Edit profile</Link>
      <Link href="/me" role="menuitem" onClick={closeMenus} className="app-menu-item">My page</Link>
      <Link href="/customer/portal" role="menuitem" onClick={closeMenus} className="app-menu-item">Customer portal</Link>
      <Link href="/customer/orders" role="menuitem" onClick={closeMenus} className="app-menu-item">Orders</Link>
      <Link href="/customer/workspaces" role="menuitem" onClick={closeMenus} className="app-menu-item">Workspaces</Link>
      <Link href="/settings/organizations" role="menuitem" onClick={closeMenus} className="app-menu-item">Organizations</Link>
      <Link href="/settings/account" role="menuitem" onClick={closeMenus} className="app-menu-item">Account</Link>
      <button
        type="button"
        role="menuitem"
        aria-expanded={mobile ? mobileThemeMenuOpen : themeMenuOpen}
        onClick={() => {
          if (mobile) setMobileThemeMenuOpen((open) => !open)
          else setThemeMenuOpen((open) => !open)
        }}
        className="app-menu-item w-full text-left"
      >
        Theme: {getThemeLabel(theme)} {(mobile ? mobileThemeMenuOpen : themeMenuOpen) ? 'v' : '>'}
      </button>
      {(mobile ? mobileThemeMenuOpen : themeMenuOpen) && renderThemeChoices(mobile)}
      <button type="button" role="menuitem" onClick={logout} className="app-menu-item w-full text-left">Sign out</button>
    </div>
  )

  const navLinkClass = (href: string) =>
    isActivePath(pathname, href) ? 'app-nav-link app-nav-link-active' : 'app-nav-link'

  return (
    <>
      <header className="app-shell-top">
        <div className="app-command-deck">
          <div className="app-command-deck-row">
            <div className="app-brand-cluster">
              <button
                type="button"
                className="app-mobile-trigger lg:hidden"
                aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileNavOpen}
                data-app-drawer-toggle="true"
                onClick={() => setMobileNavOpen((open) => !open)}
              >
                {mobileNavOpen ? 'X' : '='}
              </button>
              <Link href="/" className="app-brand-lockup" aria-label={BRAND_FULL_NAME}>
                <GearGlyph />
                <span className="app-brand-type">
                  <span className="app-brand-eyebrow">Next Gen Print Platform</span>
                  <span className="app-brand-name">
                    <span>{BRAND_LOGO_PREFIX}</span>
                    {BRAND_LOGO_SUFFIX && <span>{BRAND_LOGO_SUFFIX}</span>}
                    {BRAND_VERSION && <span className="app-brand-version"> {BRAND_VERSION}</span>}
                  </span>
                </span>
              </Link>
            </div>

            <div className="app-command-center">
              <nav className="app-primary-nav hidden lg:flex" aria-label="Primary navigation">
                {PRIMARY_LINKS.map((item) => (
                  <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
                    {item.label}
                  </Link>
                ))}
                {authed && AUTHED_LINKS.map((item) => (
                  <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
                    {item.label}
                  </Link>
                ))}
              </nav>

              <button
                type="button"
                className="app-command-surface"
                onClick={() => setCommandPaletteOpen(true)}
                aria-label="Open command palette"
              >
                <span className="app-command-surface-copy">
                  <span className="app-command-surface-label">Jump to anything</span>
                  <span className="app-command-surface-subtitle">Routes, admin tools, models, settings</span>
                </span>
                <span className="app-command-trigger-hint">Ctrl/Cmd+K</span>
              </button>
            </div>

            <div className="app-utility-cluster">
              {authed ? (
                <>
                  <Link href="/cart" className={`app-utility-pill ${isActivePath(pathname, '/cart') ? 'app-utility-pill-active' : ''}`}>
                    Cart
                    <span className="app-utility-count">{count}</span>
                  </Link>
                  <div className="relative" ref={menuRef}>
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen((open) => !open)}
                      className={`app-account-pill ${isActivePath(pathname, '/me') ? 'app-utility-pill-active' : ''}`}
                    >
                      {avatarSrc ? <img src={avatarSrc} alt="Avatar" className="h-9 w-9 rounded-full object-cover" /> : <span className="app-account-pill-fallback">Me</span>}
                    </button>
                    {menuOpen && renderAccountMenu(false)}
                  </div>
                </>
              ) : (
                <div className="hidden items-center gap-2 md:flex">
                  <Link href="/login" className="app-utility-pill">Sign in</Link>
                  <Link href="/register" className="app-cta-pill">Join</Link>
                </div>
              )}
            </div>
          </div>

          {inAdmin && (
            <div className="app-admin-rail">
              <div className="app-admin-rail-copy">
                <span className="app-admin-rail-label">Admin mode</span>
                <span className="app-admin-rail-title">{activeAdminLabel}</span>
              </div>
              <div className="app-admin-rail-links">
                {ADMIN_NAV_ITEMS.slice(0, 8).map((item) => {
                  const active = isActiveAdminPath(pathname, item)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={active ? 'app-admin-link app-admin-link-active' : 'app-admin-link'}
                    >
                      {item.label}
                    </Link>
                  )
                })}
                <Link href="/admin" className="app-admin-link">
                  Full console
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {mounted && mobileNavOpen && (
        <>
          <div className="app-mobile-scrim lg:hidden" />
          <div ref={mobileDrawerRef} className="app-mobile-drawer lg:hidden">
            <div className="app-mobile-section">
              <span className="app-mobile-kicker">Navigate</span>
              {PRIMARY_LINKS.map((item) => (
                <Link key={item.href} href={item.href} onClick={closeMenus} className={navLinkClass(item.href)}>
                  {item.label}
                </Link>
              ))}
              {authed && AUTHED_LINKS.map((item) => (
                <Link key={item.href} href={item.href} onClick={closeMenus} className={navLinkClass(item.href)}>
                  {item.label}
                </Link>
              ))}
            </div>

            {authed ? (
              <>
                <div className="app-mobile-section">
                  <span className="app-mobile-kicker">Workspace</span>
                  <Link href="/cart" onClick={closeMenus} className={navLinkClass('/cart')}>Cart ({count})</Link>
                  <Link href="/me" onClick={closeMenus} className={navLinkClass('/me')}>My page</Link>
                  <Link href="/customer/orders" onClick={closeMenus} className={navLinkClass('/customer/orders')}>Orders</Link>
                  <Link href="/customer/workspaces" onClick={closeMenus} className={navLinkClass('/customer/workspaces')}>Workspaces</Link>
                </div>
                {isAdmin && (
                  <div className="app-mobile-section">
                    <span className="app-mobile-kicker">Admin</span>
                    {ADMIN_NAV_ITEMS.map((item) => {
                      const active = isActiveAdminPath(pathname, item)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMenus}
                          className={active ? 'app-nav-link app-nav-link-active' : 'app-nav-link'}
                        >
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
                {renderAccountMenu(true)}
              </>
            ) : (
              <div className="app-mobile-section">
                <span className="app-mobile-kicker">Account</span>
                <Link href="/login" onClick={closeMenus} className={navLinkClass('/login')}>Sign in</Link>
                <Link href="/register" onClick={closeMenus} className="app-cta-pill justify-center">Join</Link>
              </div>
            )}
          </div>
        </>
      )}

      <CommandPalette
        authed={authed}
        isAdmin={isAdmin}
        cartCount={count}
        pathname={pathname}
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
    </>
  )
}
