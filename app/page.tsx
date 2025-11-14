import Link from 'next/link'
import { formatCurrency } from '@/lib/currency'

async function fetchFeatured() {
  const res = await fetch(`${process.env.BASE_URL || ''}/api/featured`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.models as any[]
}

export default async function HomePage() {
  const featured = await fetchFeatured()
  return (
    <div className="space-y-8">
      <section className="text-center py-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Dream. Discover. Deliver.</h1>
        <p className="mt-3 text-slate-300">3D print services, Model Creation, all with a smile.</p>
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
    </div>
  )
}

function FeaturedMarquee({ models }: { models: any[] }) {
  const loop = models.length > 0 ? [...models, ...models] : []
  const durationSeconds = Math.max(18, models.length * 4)
  return (
    <div className="marquee-viewport glass rounded-2xl border border-white/10 p-4">
      <div className="marquee-fade marquee-fade-left" aria-hidden="true" />
      <div className="marquee-fade marquee-fade-right" aria-hidden="true" />
      <div className="marquee-track" style={{ animationDuration: `${durationSeconds}s` }}>
        {loop.map((model, idx) => (
          <FeaturedCard key={`${model.id}-${idx}`} model={model} />
        ))}
      </div>
    </div>
  )
}

function FeaturedCard({ model }: { model: any }) {
  return (
    <Link
      href={`/models/${model.id}`}
      className="w-[280px] sm:w-[320px] md:w-[360px] flex-shrink-0 glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition"
    >
      {model.coverImagePath ? (
        <img src={`/files${model.coverImagePath}`} alt={model.title} className="aspect-video w-full object-cover" />
      ) : (
        <div className="aspect-video w-full bg-slate-900/60 flex items-center justify-center text-slate-400">No image</div>
      )}
      <div className="p-4">
        <h3 className="font-semibold truncate">{model.title}</h3>
        {model.priceUsd ? (
          <p className="text-sm text-slate-400">Est. {formatCurrency(model.priceUsd)}</p>
        ) : (
          <p className="text-sm text-slate-400">No estimate</p>
        )}
      </div>
    </Link>
  )
}
