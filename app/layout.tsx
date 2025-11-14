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

export const dynamic = 'force-dynamic'
const siteDescription = '3D printing model hosting & cost estimation'
const heroImage = '/makerworks-banner.svg'
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.BASE_URL || 'http://localhost:3000'

export const metadata = {
  title: 'MakerWorks v2',
  description: siteDescription,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent' },
  other: { 'mobile-web-app-capable': 'yes' },
  icons: {
    icon: [
      { url: '/makerworks-icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/makerworks-icon.svg',
  },
  openGraph: {
    title: 'MakerWorks v2',
    description: siteDescription,
    images: [heroImage],
    url: siteUrl,
    siteName: 'MakerWorks',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MakerWorks v2',
    description: siteDescription,
    images: [heroImage],
  },
}

export const viewport = {
  themeColor: '#000000',
}

function BrandMark() {
  return (
    <span className="flex items-center gap-3 select-none">
      <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-black/30 ring-1 ring-white/10">
        <img src="/makerworks-icon.svg" alt="" className="h-9 w-9 drop-shadow-lg" />
      </span>
      <span className="leading-tight">
        <span className="block text-xl font-semibold tracking-tight">MakerWorks v2</span>
        <span className="block text-[0.65rem] uppercase tracking-[0.55em] text-brand-300">
          Dream &middot; Discover &middot; Deliver
        </span>
      </span>
    </span>
  )
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  const authed = !!payload
  let avatarUrl: string | null = null
  let isAdmin = false
  if (payload?.sub) {
    const profile = await prisma.profile.findUnique({ where: { userId: payload.sub }, select: { avatarImagePath: true } })
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } })
    avatarUrl = toPublicHref(profile?.avatarImagePath)
    isAdmin = !!user?.isAdmin
  }
  return (
    <html lang="en">
      <body>
        <CartProvider>
        <NotificationsProvider>
        <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur header-safe">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            {authed ? (
              <Link href="/" aria-label="MakerWorks home" className="hover:opacity-90 transition-opacity">
                <BrandMark />
              </Link>
            ) : (
              <BrandMark />
            )}
            <NavBar authed={authed} isAdmin={isAdmin} avatarUrl={avatarUrl} />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 safe-padded">
          {children}
        </main>
        <footer className="border-t border-white/10 text-center text-sm text-slate-400 py-6 footer-safe">
          &copy; {new Date().getFullYear()} MakerWorks v2 &middot; Proudly made in Canada
        </footer>
        <Announcements />
        <ExtensionsGuard />
        <PWARegister />
        </NotificationsProvider>
        </CartProvider>
      </body>
    </html>
  )
}



