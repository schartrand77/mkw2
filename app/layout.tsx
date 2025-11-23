import './globals.css'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { toPublicHref } from '@/lib/storage'
import NavBar from '@/components/NavBar'
import NotificationsProvider from '@/components/notifications/NotificationsProvider'
import Announcements from '@/components/notifications/Announcements'
import PWARegister from '@/components/PWARegister'
import ExtensionsGuard from '@/components/ExtensionsGuard'
import CartProvider from '@/components/cart/CartProvider'
import HolidayEffects from '@/components/HolidayEffects'
import type { HolidayTheme } from '@/components/HolidayEffects'
import { BRAND_FULL_NAME, BRAND_LOGO_PREFIX, BRAND_LOGO_SUFFIX, BRAND_VERSION } from '@/lib/brand'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: BRAND_FULL_NAME,
  description: '3D printing model hosting & cost estimation',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent' },
  other: { 'mobile-web-app-capable': 'yes' },
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
}

export const viewport = {
  themeColor: '#000000',
}

function GearGlyph() {
  return (
    <span className="block text-lg md:text-xl leading-none" aria-hidden="true">
      ⚙️
    </span>
  )
}

function resolveHolidayTheme(): HolidayTheme | null {
  const raw = (process.env.NEXT_PUBLIC_HOLIDAY_THEME || process.env.HOLIDAY_THEME || '').toLowerCase()
  if (raw === 'christmas' || raw === 'halloween' || raw === 'easter') {
    return raw
  }
  return null
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  const authed = !!payload
  let avatarUrl: string | null = null
  let isAdmin = false
  const holidayTheme = resolveHolidayTheme()
  if (payload?.sub) {
    const profile = await prisma.profile.findUnique({ where: { userId: payload.sub }, select: { avatarImagePath: true } })
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } })
    avatarUrl = toPublicHref(profile?.avatarImagePath)
    isAdmin = !!user?.isAdmin
  }
  return (
    <html lang="en">
      <body className={holidayTheme ? `holiday-${holidayTheme}` : undefined}>
        <CartProvider>
        <NotificationsProvider>
        <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur header-safe">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
            {authed ? (
              <Link href="/" aria-label={BRAND_FULL_NAME} className="text-xl font-semibold tracking-tight">
                <span>{BRAND_LOGO_PREFIX}</span>
                <span className="inline-block align-baseline text-brand-500 gear" aria-hidden="true" style={{ animationDelay: '800ms', animationDuration: '1200ms' }}>
                  <GearGlyph />
                </span>
                {BRAND_LOGO_SUFFIX && <span>{BRAND_LOGO_SUFFIX}</span>}
                {BRAND_VERSION && <span className="text-brand-500"> {BRAND_VERSION}</span>}
              </Link>
            ) : (
              <span className="text-xl font-semibold tracking-tight select-none">
                <span>{BRAND_LOGO_PREFIX}</span>
                <span className="inline-block align-baseline text-brand-500 gear" aria-hidden="true" style={{ animationDelay: '800ms', animationDuration: '1200ms' }}>
                  <GearGlyph />
                </span>
                {BRAND_LOGO_SUFFIX && <span>{BRAND_LOGO_SUFFIX}</span>}
                {BRAND_VERSION && <span className="text-brand-500"> {BRAND_VERSION}</span>}
              </span>
            )}
            <NavBar authed={authed} isAdmin={isAdmin} avatarUrl={avatarUrl} />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 safe-padded">
          {children}
        </main>
        <footer className="border-t border-white/10 text-center text-sm text-slate-400 py-6 footer-safe">
          &copy; {new Date().getFullYear()} {BRAND_FULL_NAME} &middot; Proudly made in Canada
        </footer>
        <Announcements />
        <ExtensionsGuard />
        <HolidayEffects theme={holidayTheme} />
        <PWARegister />
        </NotificationsProvider>
        </CartProvider>
      </body>
    </html>
  )
}
