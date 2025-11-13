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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark'
    const saved = localStorage.getItem('mwv2:theme') as 'light' | 'dark' | null
    return saved === 'light' ? 'light' : 'dark'
  })
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (theme === 'light') root.classList.add('theme-light')
    else root.classList.remove('theme-light')
    try { localStorage.setItem('mwv2:theme', theme) } catch {}
  }, [theme])

  const linkCls = (href: string) => {
    const active = isActivePath(pathname, href)
    return active
      ? 'px-3 py-1.5 rounded-md bg-brand-600 border border-brand-600 text-white'
      : 'px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20'
  }

  if (!authed) {
    return (
      <nav className="flex items-center gap-3 text-sm">
        <Link href="/discover" className={linkCls('/discover')}>Discover</Link>
        <Link href="/gear" className={linkCls('/gear')}>Shop</Link>
        <Link href="/login" className={linkCls('/login')}>Sign in</Link>
        <Link href="/register" className={linkCls('/register')}>Join</Link>
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
    <nav className="flex items-center gap-3 text-sm">
      <Link href="/discover" className={linkCls('/discover')}>Discover</Link>
      <Link href="/gear" className={linkCls('/gear')}>Shop</Link>
      <Link href="/upload" className={linkCls('/upload')}>Upload</Link>
      <>
        <Link href="/cart" className={linkCls('/cart')}>Cart{count > 0 ? ` (${count})` : ''}</Link>
        {isAdmin && (
          <Link href="/admin" className={linkCls('/admin')}>Admin</Link>
        )}
        <div className="relative" ref={menuRef}>
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
