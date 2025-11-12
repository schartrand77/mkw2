import Link from 'next/link'
import { Suspense } from 'react'
import { formatCurrency } from '@/lib/currency'

async function fetchModels() {
  const res = await fetch(`${process.env.BASE_URL || ''}/api/models`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.models as any[]
}

async function fetchFeatured() {
  const res = await fetch(`${process.env.BASE_URL || ''}/api/featured`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.models as any[]
}

export default async function HomePage() {
  const [featured, models] = await Promise.all([
    fetchFeatured(),
    fetchModels(),
  ])
  return (
    <div className="space-y-8">
      <section className="text-center py-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Dream. Discover. Deliver.</h1>
        <p className="mt-3 text-slate-300">3D print services, Model Creation, all with a smile.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/upload" className="btn">Upload a Model</Link>
          <Link href="#explore" className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20">Explore</Link>
        </div>
      </section>
      {featured.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Featured</h2>
            <Link href="/discover" className="text-sm text-slate-400">See all</Link>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {featured.map((m) => (
              <Link key={m.id} href={`/models/${m.id}`} className="glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition">
                {m.coverImagePath ? (
                  <img src={`/files${m.coverImagePath}`} alt={m.title} className="aspect-video w-full object-cover" />
                ) : (
                  <div className="aspect-video w-full bg-slate-900/60 flex items-center justify-center text-slate-400">No image</div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold">{m.title}</h3>
                  {m.priceUsd ? (
                    <p className="text-sm text-slate-400">Est. {formatCurrency(m.priceUsd)}</p>
                  ) : (
                    <p className="text-sm text-slate-400">No estimate</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section id="explore" className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
        {models.length === 0 && (
          <p className="text-slate-400">No models yet. Be the first to upload!</p>
        )}
        {models.map((m) => (
          <Link key={m.id} href={`/models/${m.id}`} className="glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition">
            {m.coverImagePath ? (
              // Use direct <img> for local served files
              <img src={`/files${m.coverImagePath}`} alt={m.title} className="aspect-video w-full object-cover" />
            ) : (
              <div className="aspect-video w-full bg-slate-900/60 flex items-center justify-center text-slate-400">No image</div>
            )}
            <div className="p-4">
              <h3 className="font-semibold">{m.title}</h3>
              {m.priceUsd ? (
                <p className="text-sm text-slate-400">Est. {formatCurrency(m.priceUsd)}</p>
              ) : (
                <p className="text-sm text-slate-400">No estimate</p>
              )}
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
