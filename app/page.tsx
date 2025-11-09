import Link from 'next/link'
import { Suspense } from 'react'

async function fetchModels() {
  const res = await fetch(`${process.env.BASE_URL || ''}/api/models`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.models as any[]
}

export default async function HomePage() {
  const models = await fetchModels()
  return (
    <div className="space-y-8">
      <section className="text-center py-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Discover, Share, and Print 3D Models</h1>
        <p className="mt-3 text-slate-300">Host your models, preview in 3D, and estimate print costs.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/upload" className="btn">Upload a Model</Link>
          <Link href="#explore" className="px-4 py-2 rounded-md border border-white/10 hover:border-white/20">Explore</Link>
        </div>
      </section>
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
                <p className="text-sm text-slate-400">Est. ${m.priceUsd.toFixed(2)}</p>
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

