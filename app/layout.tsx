import './globals.css'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export const metadata = {
  title: 'MakerWorks v2',
  description: '3D printing model hosting & cost estimation'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get('mwv2_token')?.value
  const authed = token ? !!verifyToken(token) : false
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold tracking-tight">MakerWorks<span className="text-brand-500"> v2</span></Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link href="/discover" className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20">Discover</Link>
              <Link href="/upload" className="btn">Upload</Link>
              {authed ? (
                <>
                  <Link href="/likes" className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20">Likes</Link>
                  <Link href="/me" className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20">My Page</Link>
                </>
              ) : (
                <Link href="/login" className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20">Sign in</Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-white/10 text-center text-sm text-slate-400 py-6">
          © {new Date().getFullYear()} MakerWorks v2
        </footer>
      </body>
    </html>
  )
}
