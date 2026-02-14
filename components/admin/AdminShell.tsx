'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'

const STORAGE_KEY = 'mwv2_admin_sidebar_desktop_visible'

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [desktopVisible, setDesktopVisible] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === '0') setDesktopVisible(false)
    } catch {
      // no-op for private mode / unavailable storage
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, desktopVisible ? '1' : '0')
    } catch {
      // no-op for private mode / unavailable storage
    }
  }, [desktopVisible])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  function toggleSidebar() {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      setDesktopVisible((current) => !current)
      return
    }
    setMobileOpen((current) => !current)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggleSidebar}
          className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-200 hover:border-white/30"
          aria-expanded={mobileOpen || desktopVisible}
          aria-controls="admin-sidebar-shell"
        >
          <span aria-hidden="true">|||</span>
          <span>Toggle Sidebar</span>
        </button>
      </div>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-[1290] bg-black/70 backdrop-blur-md lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className={`flex gap-6 transition-[gap] duration-200 ${desktopVisible ? 'lg:gap-6' : 'lg:gap-0'}`}>
        <div
          id="admin-sidebar-shell"
          className={`fixed inset-y-0 left-0 z-[1300] w-72 p-4 transition-transform duration-200 lg:static lg:inset-auto lg:z-auto lg:w-auto lg:p-0 lg:transition-[width,opacity] ${mobileOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'} ${desktopVisible ? 'lg:translate-x-0 lg:w-[250px] lg:opacity-100 lg:pointer-events-auto' : 'lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none'}`}
        >
          <AdminSidebar
            className="h-full overflow-auto lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)]"
            onNavigate={() => setMobileOpen(false)}
          />
        </div>

        <section className="min-w-0 flex-1 lg:w-full">{children}</section>
      </div>
    </div>
  )
}
