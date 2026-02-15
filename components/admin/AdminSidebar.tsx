'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_NAV_SECTIONS } from '@/lib/admin/navigation'
import type { AdminNavSection } from '@/lib/admin/navigation'

type Props = {
  className?: string
  onNavigate?: () => void
}

function isActivePath(pathname: string, href: string, prefixes: string[] = []) {
  if (pathname === href) return true
  if (href !== '/admin' && pathname.startsWith(`${href}/`)) return true
  return prefixes.some(prefix => pathname.startsWith(prefix))
}

function SectionIcon({ icon }: { icon: AdminNavSection['icon'] }) {
  if (icon === 'core') {
    return (
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-slate-400" aria-hidden="true">
        <path d="M10 3l6 3.5v7L10 17l-6-3.5v-7L10 3zm0 2.1L6 7.4v5.2l4 2.3 4-2.3V7.4l-4-2.3z" fill="currentColor" />
      </svg>
    )
  }
  if (icon === 'operations') {
    return (
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-slate-400" aria-hidden="true">
        <path d="M11 2l1 3h3l-2.4 1.8L13.5 10 11 8.2 8.5 10l.9-3.2L7 5h3l1-3zM4 11h5v2H4v-2zm0 4h8v2H4v-2zm10-4h2v6h-2v-6z" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-slate-400" aria-hidden="true">
      <path d="M10 2l2.3 4.7 5.2.8-3.8 3.7.9 5.2L10 14l-4.6 2.4.9-5.2L2.5 7.5l5.2-.8L10 2zm0 3.6L8.9 7.9l-2.6.4 1.9 1.8-.5 2.6L10 11.5l2.3 1.2-.5-2.6 1.9-1.8-2.6-.4L10 5.6z" fill="currentColor" />
    </svg>
  )
}

export default function AdminSidebar({ className = '', onNavigate }: Props) {
  const pathname = usePathname()

  return (
    <aside className={`rounded-xl border border-white/10 bg-black/20 p-4 ${className}`.trim()}>
      <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Admin</div>
      <nav className="mt-4 space-y-5" aria-label="Admin navigation">
        {ADMIN_NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <SectionIcon icon={section.icon} />
              <span>{section.title}</span>
            </p>
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
