"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

  const linkCls = (href: string) => {
    const active = isActivePath(pathname, href)
    return active
      ? 'px-3 py-1.5 rounded-md bg-brand-600 border border-brand-600 text-white'
      : 'px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20'
  }

  return (
    <nav className="flex items-center gap-3 text-sm">
      <Link href="/discover" className={linkCls('/discover')}>Discover</Link>
      <Link href="/upload" className={linkCls('/upload')}>Upload</Link>
      {authed ? (
        <>
          <Link href="/likes" className={linkCls('/likes')}>Likes</Link>
          {isAdmin && (
            <Link href="/admin" className={linkCls('/admin')}>Admin</Link>
          )}
          {avatarUrl ? (
            <Link href="/me" aria-label="My Page" className={isActivePath(pathname, '/me') ? 'rounded-full ring-2 ring-brand-600' : ''}>
              <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10 object-cover" />
            </Link>
          ) : (
            <Link href="/me" className={linkCls('/me')}>My Page</Link>
          )}
        </>
      ) : (
        <Link href="/login" className={linkCls('/login')}>Sign in</Link>
      )}
    </nav>
  )
}

