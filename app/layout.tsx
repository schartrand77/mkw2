import './globals.css'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { toPublicHref } from '@/lib/storage'
import AppSidebar from '@/components/AppSidebar'
import NotificationsProvider from '@/components/notifications/NotificationsProvider'
import Announcements from '@/components/notifications/Announcements'
import PWARegister from '@/components/PWARegister'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import ExtensionsGuard from '@/components/ExtensionsGuard'
import CartProvider from '@/components/cart/CartProvider'
import HolidayEffects from '@/components/HolidayEffects'
import ClientErrorReporter from '@/components/ClientErrorReporter'
import type { HolidayTheme } from '@/components/HolidayEffects'
import { BRAND_FULL_NAME, MAKERWORKS_PRINT_LAB_URL, PARENT_COMPANY_NAME, PARENT_COMPANY_URL } from '@/lib/brand'
import { PaymentBadges } from '@/components/PaymentBadges'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: BRAND_FULL_NAME,
  description: '3D printing model hosting & cost estimation',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BRAND_FULL_NAME,
    startupImage: ['/apple-touch-icon.png'],
  },
  other: { 'mobile-web-app-capable': 'yes' },
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
}

export const viewport = {
  themeColor: '#1f2026',
  viewportFit: 'cover' as const,
}

const themeBootstrapScript = `
(function(){
  try {
    var theme = localStorage.getItem('mwv2:theme');
    if (theme !== 'light' && theme !== 'dark' && theme !== 'oled') theme = 'dark';
    var root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-oled');
    root.classList.add('theme-' + theme);
  } catch (error) {
    document.documentElement.classList.add('theme-dark');
  }
})();
`

function resolveHolidayTheme(): HolidayTheme | null {
  const rawInput = process.env.HOLIDAY_THEME || ''
  const raw = rawInput.trim().replace(/^['"]|['"]$/g, '').toLowerCase()
  if (raw === 'may the fourth' || raw === 'may-the-fourth' || raw === 'may_the_fourth') {
    return 'maythefourth'
  }
  if (raw === 'canada day' || raw === 'canada-day' || raw === 'canada_day') {
    return 'canadaday'
  }
  if (raw === 'christmas' || raw === 'halloween' || raw === 'easter' || raw === 'valentines' || raw === 'maythefourth' || raw === 'canadaday') {
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={holidayTheme ? `holiday-${holidayTheme}` : undefined}>
        <CartProvider>
          <NotificationsProvider>
            <div className="mx-auto flex w-full max-w-[1400px] gap-4 px-4 py-4 md:gap-6 md:py-6 safe-padded">
              <AppSidebar authed={authed} isAdmin={isAdmin} avatarUrl={avatarUrl} />
              <div className="app-content-shell min-w-0 flex-1">
                <main className="app-main relative z-0">
                  {children}
                </main>
                <footer className="footer-shell app-footer footer-safe">
                  <div className="footer-business-grid">
                    <section className="footer-company" aria-label={`${PARENT_COMPANY_NAME} company summary`}>
                      <a href={PARENT_COMPANY_URL} target="_blank" rel="noreferrer" className="footer-parent-mark" aria-label={`${PARENT_COMPANY_NAME} home`}>
                        <span className="footer-parent-r footer-parent-r-back">r</span><span>3D</span><span className="footer-parent-r">r</span>
                      </a>
                      <p className="footer-parent-line">An r3Dr company</p>
                      <p className="footer-company-copy">
                        {BRAND_FULL_NAME} is part of the r3Dr portfolio, connecting print-lab software, production workflows, and practical 3D printing services.
                      </p>
                      <div className="footer-company-meta">
                        <span>&copy; {new Date().getFullYear()} {BRAND_FULL_NAME}</span>
                        <span className="footer-leaf">
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5 text-red-400/90"
                            fill="currentColor"
                          >
                            <path d="M12 2.2c.4 0 .7.3.8.6l1.2 3.1 3.4-.7c.3-.1.7.1.9.4.2.3.2.7 0 1l-2.3 2.7 2.1 1.3c.3.2.4.6.3 1-.1.4-.4.6-.8.6h-2.9l.8 3.7c.1.4-.1.8-.4 1-.3.2-.7.2-1 0l-2.1-1.6-2.1 1.6c-.3.2-.7.2-1 0-.3-.2-.5-.6-.4-1l.8-3.7H6.8c-.4 0-.7-.2-.8-.6-.1-.4 0-.8.3-1l2.1-1.3-2.3-2.7c-.2-.3-.2-.7 0-1 .2-.3.6-.5.9-.4l3.4.7 1.2-3.1c.1-.3.4-.6.8-.6Z" />
                          </svg>
                          Proudly made in Canada
                        </span>
                      </div>
                    </section>
                    <nav className="footer-link-group" aria-label="MakerWorks links">
                      <h2>MakerWorks</h2>
                      <Link href="/discover">Discover models</Link>
                      <Link href="/products">Store</Link>
                      <Link href="/upload">Upload a model</Link>
                      <a href={MAKERWORKS_PRINT_LAB_URL} target="_blank" rel="noreferrer">MakerWorks 3D Print Lab</a>
                    </nav>
                    <nav className="footer-link-group" aria-label="r3Dr portfolio links">
                      <h2>r3Dr Portfolio</h2>
                      <a href={PARENT_COMPANY_URL} target="_blank" rel="noreferrer">r3dr.ca</a>
                      <a href="https://makerworks.app" target="_blank" rel="noreferrer">makerworks.app</a>
                      <a href={MAKERWORKS_PRINT_LAB_URL} target="_blank" rel="noreferrer">makerworks3d.com</a>
                      <a href="mailto:contact@r3dr.ca">Contact r3Dr</a>
                    </nav>
                    <section className="footer-payments" aria-label="Payment support">
                      <h2>Checkout</h2>
                      <p>Secure checkout for print jobs, products, and custom work.</p>
                      <PaymentBadges showApplePay={showApplePayBadge} showGooglePay={showGooglePayBadge} />
                    </section>
                  </div>
                </footer>
              </div>
            </div>
            <Announcements enabled={authed} />
            <ExtensionsGuard />
            <ClientErrorReporter />
            <HolidayEffects theme={holidayTheme} />
            <PWARegister />
            <PWAInstallPrompt />
          </NotificationsProvider>
        </CartProvider>
      </body>
    </html>
  )
}
