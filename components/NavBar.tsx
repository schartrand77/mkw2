"use client"
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from '@/components/cart/CartProvider'
import { pushSessionNotification } from '@/components/notifications/NotificationsProvider'
import { useEffect, useRef, useState } from 'react'

type Props = {
  authed: boolean
  isAdmin: boolean
  avatarUrl: string | null
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  // Special-case: "/me" redirects to "/u/..." but should still count as active
  if (href === '/me') return pathname.startsWith('/u') || pathname === '/me'
  return pathname === href || pathname.startsWith(href + '/')
}

export default function NavBar({ authed, isAdmin, avatarUrl }: Props) {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(avatarUrl)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { count } = useCart()
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

  // Theme toggle (light/dark)
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
    try { localStorage.setItem('mwv2:theme', theme) } catch {}
  }, [theme])

  const linkCls = (href: string) => {
    const active = isActivePath(pathname, href)
    return active
      ? 'px-3 py-1.5 rounded-md bg-brand-600 border border-brand-600 text-white flex-shrink-0'
      : 'px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20 flex-shrink-0'
  }
  const navContainerCls = 'flex items-center gap-3 text-sm w-full min-w-0 sm:w-auto text-left'
  const scrollCls = 'flex items-center gap-3 overflow-x-auto overflow-y-visible whitespace-nowrap pr-4 [-webkit-overflow-scrolling:touch] sm:overflow-visible sm:whitespace-normal sm:pr-0'

  if (!authed) {
    return (
      <nav className={navContainerCls}>
        <div className={scrollCls}>
          <Link href="/discover" className={linkCls('/discover')}>Discover</Link>
          <Link href="/gear" className={linkCls('/gear')}>Shop</Link>
          <Link href="/login" className={linkCls('/login')}>Sign in</Link>
          <Link href="/register" className={linkCls('/register')}>Join</Link>
        </div>
      </nav>
    )
  }

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

  return (
    <nav className={navContainerCls}>
      <div className={scrollCls}>
        <Link href="/discover" className={linkCls('/discover')}>Discover</Link>
        <Link href="/gear" className={linkCls('/gear')}>Shop</Link>
        <Link href="/upload" className={linkCls('/upload')}>Upload</Link>
        <Link href="/cart" className={linkCls('/cart')}>Cart{count > 0 ? ` (${count})` : ''}</Link>
        <Link href="/checkout" className={linkCls('/checkout')}>Checkout</Link>
        {isAdmin && (
          <Link href="/admin" className={linkCls('/admin')}>Admin</Link>
        )}
      </div>
      <>
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}
            className={isActivePath(pathname, '/me') ? 'rounded-full ring-2 ring-brand-600' : ''}
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10 object-cover" />
            ) : (
              <span className="px-3 py-1.5 rounded-md border border-white/10">Me</span>
            )}
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 mt-2 w-44 glass rounded-md border border-white/10 py-1 z-50">
              <Link href="/settings/profile" role="menuitem" className="block px-3 py-2 hover:bg-white/10">Edit Profile</Link>
              <Link href="/me" role="menuitem" className="block px-3 py-2 hover:bg-white/10">My Page</Link>
              <Link href="/settings/account" role="menuitem" className="block px-3 py-2 hover:bg-white/10">Account</Link>
              <button role="menuitem" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} className="block w-full text-left px-3 py-2 hover:bg-white/10">
                Theme: {theme === 'light' ? 'Light' : 'Dark'} (toggle)
              </button>
              <button role="menuitem" onClick={logout} className="block w-full text-left px-3 py-2 hover:bg-white/10">Sign out</button>
            </div>
          )}
        </div>
      </>
    </nav>
  )
}
