'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_NAV_SECTIONS } from '@/lib/admin/navigation'

type Props = {
  className?: string
  onNavigate?: () => void
}

function isActivePath(pathname: string, href: string, prefixes: string[] = []) {
  if (pathname === href) return true
  if (href !== '/admin' && pathname.startsWith(`${href}/`)) return true
  return prefixes.some(prefix => pathname.startsWith(prefix))
}

export default function AdminSidebar({ className = '', onNavigate }: Props) {
  const pathname = usePathname()

  return (
    <aside className={`rounded-xl border border-white/10 bg-black/20 p-4 ${className}`.trim()}>
      <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Admin</div>
      <nav className="mt-4 space-y-5" aria-label="Admin navigation">
        {ADMIN_NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{section.title}</p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href, item.matchPrefixes)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={`block rounded-md px-3 py-2 text-sm transition ${active ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
