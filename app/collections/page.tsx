import Link from 'next/link'
import { listActiveCollections } from '@/lib/collections'
import { buildImageSrc } from '@/lib/public-path'

export const dynamic = 'force-dynamic'

export default async function CollectionsPage() {
  const collections = await listActiveCollections(20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Collections</h1>
        <Link href="/discover" className="text-sm text-brand-400 hover:text-brand-300 underline underline-offset-4">
          Back to Discover
        </Link>
      </div>
      {collections.length === 0 ? (
        <div className="glass p-6 rounded-xl text-slate-400">
          No collections are live right now. Check back soon.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => {
            const cover = buildImageSrc(collection.heroImagePath, null)
            return (
              <Link
                key={collection.id}
                href={`/collections/${collection.slug}`}
                className="group rounded-2xl border border-white/10 bg-black/20 overflow-hidden hover:border-white/20 transition"
              >
                {cover ? (
                  <img src={cover} alt="" className="h-40 w-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="h-40 w-full bg-slate-900/60" />
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold group-hover:text-white">{collection.title}</h2>
                    {collection.kind === 'material_popular' && collection.materialKey ? (
                      <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{collection.materialKey}</span>
                    ) : null}
                  </div>
                  {collection.description ? (
                    <p className="text-sm text-slate-400">{collection.description}</p>
                  ) : (
                    <p className="text-sm text-slate-400">Browse the curated drop.</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
