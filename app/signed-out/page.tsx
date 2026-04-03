import Link from 'next/link'
import { BRAND_FULL_NAME } from '@/lib/brand'
import { getUserIdFromCookie } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ClearClientState from './ClearClientState'

export const metadata = {
  title: `Signed out | ${BRAND_FULL_NAME}`,
  description: `You are now signed out of ${BRAND_FULL_NAME}.`,
}

export default async function SignedOutPage() {
  const userId = await getUserIdFromCookie()
  if (userId) redirect('/discover')

  return (
    <div className="max-w-2xl mx-auto text-center space-y-6">
      <ClearClientState />
      <div className="glass rounded-3xl border border-white/10 px-6 py-10 space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{BRAND_FULL_NAME}</p>
        <h1 className="text-3xl font-semibold">You are signed out</h1>
        <p className="text-slate-300">
          Thanks for stopping by. You can sign back in anytime, or continue browsing the site.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/login" className="btn">Sign back in</Link>
          <Link href="/discover" className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20 text-sm text-slate-200">
            Back to Discover
          </Link>
        </div>
      </div>
    </div>
  )
}
