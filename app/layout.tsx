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
export const metadata = {
  title: 'MakerWorks v2',
  description: '3D printing model hosting & cost estimation',
  manifest: '/manifest.webmanifest',
  themeColor: '#000000',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent' },
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
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
              <Link href="/" aria-label="MakerWorks v2" className="text-xl font-semibold tracking-tight">
                <span>MakerW</span>
                <span className="inline-block align-baseline text-brand-500 gear" aria-hidden="true" style={{ animationDelay: '800ms', animationDuration: '1200ms' }}>âš™</span>
                <span>rks</span>
                <span className="text-brand-500"> v2</span>
              </Link>
            ) : (
              <span className="text-xl font-semibold tracking-tight select-none">
                <span>MakerW</span>
                <span className="inline-block align-baseline text-brand-500 gear" aria-hidden="true" style={{ animationDelay: '800ms', animationDuration: '1200ms' }}>âš™</span>
                <span>rks</span>
                <span className="text-brand-500"> v2</span>
              </span>
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

