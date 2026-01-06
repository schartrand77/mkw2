import Link from 'next/link'
import { BRAND_SLUG } from '@/lib/brand'
import { resolveBaseUrl } from '@/lib/base-url'
import FeaturedMarquee from '@/components/FeaturedMarquee'

async function fetchFeatured(baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/featured`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.models as any[]
}

export default async function HomePage() {
  const baseUrl = await resolveBaseUrl()
  const featured = await fetchFeatured(baseUrl)
  const defaultContactEmail = `info@${BRAND_SLUG}.app`
  const runtimeContactEmail = process.env['NEXT_PUBLIC_CONTACT_EMAIL']
  const contactEmail = runtimeContactEmail && runtimeContactEmail.trim().length > 0 ? runtimeContactEmail : defaultContactEmail
  return (
    <div className="space-y-8">
      <section className="text-center py-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          <span aria-label="Dream">
            Dre<span aria-hidden="true" className="valentines-heart">♥</span><span aria-hidden="true" className="valentines-heart-fallback">a</span>m
          </span>
          . Discover. Deliver.
        </h1>
        <p className="mt-3 text-slate-300">Bringing your ideas to life, one layer at a time.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/upload" className="btn">Upload a Model</Link>
          <Link href="/discover" className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20">Browse Library</Link>
        </div>
      </section>
      {featured.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-brand-300/80">Spotlight</p>
              <h2 className="text-xl font-semibold mt-1">Featured models</h2>
            </div>
            <Link href="/discover" className="text-sm text-slate-400 hover:text-white transition">See full collection</Link>
          </div>
          <FeaturedMarquee models={featured} />
        </section>
      ) : (
        <section className="text-center py-16 glass rounded-2xl border border-white/10">
          <p className="text-lg font-semibold">Featured models coming soon.</p>
          <p className="text-slate-400 mt-2">Check out the full library on the Discover page in the meantime.</p>
          <Link href="/discover" className="btn mt-6">Go to Discover</Link>
        </section>
      )}
      <section className="text-center py-8">
        <h3 className="text-2xl font-semibold mb-3">Ready to explore more?</h3>
        <p className="text-slate-400 mb-5">Browse hundreds of community models, parts, and curated kits.</p>
        <Link href="/discover" className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20">Open Discover</Link>
      </section>
      <section className="glass rounded-2xl border border-white/10 p-8 text-center space-y-4">
        <h3 className="text-2xl font-semibold">Questions or custom work?</h3>
        <p className="text-slate-400">
          Email us anytime for order updates, collaboration requests, or lab availability.
        </p>
        <a
          href={`mailto:${contactEmail}`}
          className="inline-flex items-center justify-center px-5 py-2 rounded-md border border-white/20 text-base font-medium tracking-wide hover:border-white/40"
        >
          {contactEmail}
        </a>
      </section>
    </div>
  )
}
