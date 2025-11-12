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
  other: { 'mobile-web-app-capable': 'yes' },
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
}

function GearGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className="h-4 w-4 md:h-5 md:w-5"
      focusable="false"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.555.834a1 1 0 01.89 0l2.139 1.02c.167.08.36.092.535.033l2.307-.769a1 1 0 011.27.65l.758 2.32a1 1 0 00.35.5l1.917 1.47a1 1 0 01.216 1.35l-1.243 1.92a1 1 0 00-.147.59l.107 2.438a1 1 0 01-.987 1.04l-2.446.1a1 1 0 00-.562.2l-1.945 1.485a1 1 0 01-1.356-.169l-1.526-1.815a1 1 0 00-.534-.33l-2.371-.6a1 1 0 01-.747-.92l-.121-2.449a1 1 0 00-.281-.653L.6 8.165a1 1 0 01.087-1.51l1.94-1.47a1 1 0 00.368-.515l.72-2.382a1 1 0 011.273-.673l2.329.776a1 1 0 00.583-.031L9.555.834zM10 13.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
      />
    </svg>
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
              <Link href="/" aria-label="MakerWorks v2" className="text-xl font-semibold tracking-tight">
                <span>MakerW</span>
                <span className="inline-block align-baseline text-brand-500 gear" aria-hidden="true" style={{ animationDelay: '800ms', animationDuration: '1200ms' }}>
                  <GearGlyph />
                </span>
                <span>rks</span>
                <span className="text-brand-500"> v2</span>
              </Link>
            ) : (
              <span className="text-xl font-semibold tracking-tight select-none">
                <span>MakerW</span>
                <span className="inline-block align-baseline text-brand-500 gear" aria-hidden="true" style={{ animationDelay: '800ms', animationDuration: '1200ms' }}>
                  <GearGlyph />
                </span>
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



