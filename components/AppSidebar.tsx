"use client"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from '@/components/cart/CartProvider'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'
import { useEffect, useRef, useState } from 'react'
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(avatarUrl)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { count } = useCart()
  const inAdmin = pathname.startsWith('/admin')

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.toggle('sidebar-open', mobileOpen)
    return () => {
      document.body.classList.remove('sidebar-open')
    }
  }, [mobileOpen])

  useEffect(() => {
    if (inAdmin) setAdminOpen(true)
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
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false)
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
          if (fallback) setAvatarSrc(fallback)
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

  return (
    <>
      <button
        type="button"
        className="app-sidebar-toggle lg:hidden"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
        aria-controls="app-sidebar"
      >
        <span aria-hidden="true">|||</span>
        <span>Menu</span>
      </button>

      {mobileOpen && <button type="button" className="app-sidebar-backdrop lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

      <aside id="app-sidebar" className={`app-sidebar ${mobileOpen ? 'app-sidebar-open' : ''}`}>
        <div className="app-sidebar-inner">
          <Link href="/" aria-label={BRAND_FULL_NAME} className="app-sidebar-brand">
            <span>{BRAND_LOGO_PREFIX}</span>
            <span className="inline-block align-baseline text-brand-500 gear app-brand-gear-tight" aria-hidden="true" style={{ animationDelay: '800ms', animationDuration: '1200ms' }}>
              <GearGlyph />
            </span>
            {BRAND_LOGO_SUFFIX && <span>{BRAND_LOGO_SUFFIX}</span>}
            {BRAND_VERSION && <span className="text-brand-500"> {BRAND_VERSION}</span>}
          </Link>

          <nav className="mt-5 space-y-1" aria-label="Main navigation">
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
                {menuOpen && (
                  <div role="menu" className="app-sidebar-menu">
                    <Link href="/settings/profile" role="menuitem" className="app-sidebar-menu-item">Edit Profile</Link>
                    <Link href="/me" role="menuitem" className="app-sidebar-menu-item">My Page</Link>
                    <Link href="/customer/portal" role="menuitem" className="app-sidebar-menu-item">Customer Portal</Link>
                    <Link href="/customer/orders" role="menuitem" className="app-sidebar-menu-item">Orders</Link>
                    <Link href="/settings/account" role="menuitem" className="app-sidebar-menu-item">Account</Link>
                    <button type="button" role="menuitem" onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))} className="app-sidebar-menu-item w-full text-left">
                      {theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                    </button>
                    <button role="menuitem" onClick={logout} className="app-sidebar-menu-item w-full text-left">Sign out</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
