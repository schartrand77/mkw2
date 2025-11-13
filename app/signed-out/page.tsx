import Link from 'next/link'
import { buildAmazonSearchUrl, DEFAULT_AMAZON_QUERY } from '@/lib/amazon'

export const metadata = {
  title: 'Signed out | MakerWorks v2',
  description: 'You are now signed out of MakerWorks v2. Rejoin or browse our Amazon affiliate picks.',
}

export default function SignedOutPage() {
  const affiliateUrl = buildAmazonSearchUrl(DEFAULT_AMAZON_QUERY, 'makerworks_v2_signed_out_cta')
  return (
    <div className="max-w-2xl mx-auto text-center space-y-6">
      <div className="glass rounded-3xl border border-white/10 px-6 py-10 space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">MakerWorks v2</p>
        <h1 className="text-3xl font-semibold">You are signed out</h1>
        <p className="text-slate-300">
          Thanks for stopping by. You can sign back in anytime, or browse our curated Amazon picks for tools
          and accessories while you are here.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/login" className="btn">Sign back in</Link>
          <a
            href={affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20 text-sm text-slate-200"
          >
            Shop Amazon gear
          </a>
        </div>
        <p className="text-xs text-slate-500 pt-2">
          As an Amazon Associate, MakerWorks may earn from qualifying purchases. Pricing and availability update on Amazon.
        </p>
      </div>
      <div className="glass rounded-2xl border border-white/10 p-5 text-left space-y-2">
        <h2 className="text-lg font-semibold">Why shop from our affiliate picks?</h2>
        <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
          <li>Every collection is filtered for maker-ready supplies.</li>
          <li>Purchases help support the MakerWorks lab at no extra cost to you.</li>
          <li>Handy for restocking filament, magnets, LEDs, and finishing tools between uploads.</li>
        </ul>
        <div className="text-xs text-slate-500">
          Prefer to keep browsing models? <Link href="/discover" className="underline">Head back to Discover</Link>.
        </div>
      </div>
    </div>
  )
}
