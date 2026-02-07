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
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
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
  if (raw === 'christmas' || raw === 'halloween' || raw === 'easter' || raw === 'valentines') {
    return raw
  }
  return null
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  const authed = !!payload
  let avatarUrl: string | null = null
  let isAdmin = false
  const holidayTheme = resolveHolidayTheme()
    if (payload?.sub) {
      const profile = await prisma.profile.findUnique({ where: { userId: payload.sub }, select: { avatarImagePath: true } })
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
      const role = user?.role || null
      avatarUrl = toPublicHref(profile?.avatarImagePath)
      isAdmin = !!(user?.isAdmin || role === 'admin' || role === 'staff')
    }
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { id: 'main' },
    select: { showApplePayBadge: true, showGooglePayBadge: true },
  })
  const showApplePayBadge = !!siteConfig?.showApplePayBadge
  const showGooglePayBadge = !!siteConfig?.showGooglePayBadge
  return (
    <html lang="en">
      <body className={holidayTheme ? `holiday-${holidayTheme}` : undefined}>
        <CartProvider>
        <NotificationsProvider>
        <header className="sticky top-0 z-[1200] header-shell header-safe relative isolate">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
            <Link href="/" aria-label={BRAND_FULL_NAME} className="text-xl font-semibold tracking-tight">
              <span>{BRAND_LOGO_PREFIX}</span>
              <span className="inline-block align-baseline text-brand-500 gear" aria-hidden="true" style={{ animationDelay: '800ms', animationDuration: '1200ms' }}>
                <GearGlyph />
              </span>
              {BRAND_LOGO_SUFFIX && <span>{BRAND_LOGO_SUFFIX}</span>}
              {BRAND_VERSION && <span className="text-brand-500"> {BRAND_VERSION}</span>}
            </Link>
            <NavBar authed={authed} isAdmin={isAdmin} avatarUrl={avatarUrl} />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 safe-padded relative z-0">
          {children}
        </main>
        <footer className="footer-shell text-center text-sm text-slate-400/80 py-6 footer-safe">
          <div className="flex flex-col items-center justify-center gap-2">
            <span>
              &copy; {new Date().getFullYear()} {BRAND_FULL_NAME}
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="inline-block h-3 w-3 align-middle mx-2 text-red-400/90 relative -top-px"
                fill="currentColor"
              >
                <path d="M12 2.2c.4 0 .7.3.8.6l1.2 3.1 3.4-.7c.3-.1.7.1.9.4.2.3.2.7 0 1l-2.3 2.7 2.1 1.3c.3.2.4.6.3 1-.1.4-.4.6-.8.6h-2.9l.8 3.7c.1.4-.1.8-.4 1-.3.2-.7.2-1 0l-2.1-1.6-2.1 1.6c-.3.2-.7.2-1 0-.3-.2-.5-.6-.4-1l.8-3.7H6.8c-.4 0-.7-.2-.8-.6-.1-.4 0-.8.3-1l2.1-1.3-2.3-2.7c-.2-.3-.2-.7 0-1 .2-.3.6-.5.9-.4l3.4.7 1.2-3.1c.1-.3.4-.6.8-.6Z" />
              </svg>
              Proudly made in Canada
            </span>
            {(showApplePayBadge || showGooglePayBadge) && (
              <span className="flex items-center gap-2">
                {showApplePayBadge && <img src="/ApplePay.svg" alt="Apple Pay" className="h-4 w-auto opacity-80" loading="lazy" />}
                {showGooglePayBadge && <img src="/GooglePay.png" alt="Google Pay" className="h-4 w-auto opacity-80" loading="lazy" />}
              </span>
            )}
          </div>
        </footer>
        <Announcements enabled={authed} />
        <ExtensionsGuard />
        <HolidayEffects theme={holidayTheme} />
        <PWARegister />
        <PWAInstallPrompt />
        </NotificationsProvider>
        </CartProvider>
      </body>
    </html>
  )
}
