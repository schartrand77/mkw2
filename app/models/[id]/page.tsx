import Gallery from '@/components/Gallery'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency } from '@/lib/currency'
import { buildYouTubeEmbedUrl } from '@/lib/youtube'

async function fetchModel(id: string) {
  const res = await fetch(`${process.env.BASE_URL || ''}/api/models/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()).model as any
}

export default async function ModelDetail({ params, searchParams }: { params: { id: string }, searchParams?: { [k: string]: string | string[] | undefined } }) {
  const model = await fetchModel(params.id)
  if (!model) return <div>Not found</div>
  const toFileUrl = (path?: string | null) => {
    if (!path) return ''
    const normalized = path.startsWith('/') ? path : `/${path}`
    return `/files${normalized}`
  }
  const src = toFileUrl(model.filePath)
  const hasParts = Array.isArray(model.parts) && model.parts.length > 0
  const videoEmbedUrl = model.videoEmbedId ? buildYouTubeEmbedUrl(model.videoEmbedId) : null
  const affiliateHost = model.affiliateUrl ? (() => {
    try {
      const rawHost = new URL(model.affiliateUrl).hostname
      return rawHost.replace(/^www\./i, '') || 'amazon.ca'
    } catch {
      return 'amazon.ca'
    }
  })() : null
  const token = cookies().get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  const me = payload?.sub ? await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } }) : null
  const canEdit = !!(payload?.sub && (payload.sub === model.userId || me?.isAdmin))
  return (
    <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-8">
      <div>
        <Gallery
          coverSrc={model.coverImagePath ? toFileUrl(model.coverImagePath) : null}
          parts={hasParts ? model.parts : []}
          allSrc={src || null}
          images={model.images || []}
        />
      </div>
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">{model.title}</h1>
        {model.tags && model.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {model.tags.map((t: any) => (
              <Link key={t.slug} href={`/discover?tags=${t.slug}`} className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20 text-xs">#{t.name}</Link>
            ))}
          </div>
        )}
        <div className="glass rounded-xl p-4 text-slate-300 whitespace-pre-wrap">{model.description || 'No description provided.'}</div>
        {videoEmbedUrl && (
          <div className="glass rounded-xl overflow-hidden">
            <div className="aspect-video bg-black">
              <iframe
                src={videoEmbedUrl}
                title={`${model.title} video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <div className="px-4 py-3 text-xs text-slate-400 border-t border-white/5">
              Build video provided by the creator
            </div>
          </div>
        )}
        <div className="glass rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
          <div className="text-slate-400">Material</div>
          <div>{model.material}</div>
          <div className="text-slate-400">File Type</div>
          <div>{model.fileType}</div>
          <div className="text-slate-400">Volume</div>
          <div>{model.volumeMm3 ? `${(model.volumeMm3/1000).toFixed(2)} cm^3` : 'N/A'}</div>
          <div className="text-slate-400">Estimated Price</div>
          <div>{model.priceUsd ? formatCurrency(model.priceUsd) : 'N/A'}</div>
        </div>
        {model.affiliateUrl && (
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Required parts</div>
            <div>
              <p className="text-lg font-semibold">{model.affiliateTitle || 'Recommended hardware'}</p>
              <p className="text-sm text-slate-300">
                Link provided by the maker so you can grab the exact companion parts (springs, screws, electronics, etc.) this model expects.
              </p>
            </div>
            <a
              href={model.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn w-full md:w-auto text-center"
            >
              Shop on {affiliateHost || 'Amazon'}
            </a>
            <p className="text-xs text-slate-500">
              As an Amazon Associate, MakerWorks may earn from qualifying purchases. Pricing/availability updates instantly on Amazon.
            </p>
          </div>
        )}
        {hasParts && (
          <div className="glass rounded-xl p-4 text-sm">
            <div className="font-semibold mb-2">Parts breakdown</div>
            <ul className="divide-y divide-white/10">
              {model.parts.map((p: any, i: number) => (
                <li key={p.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-slate-400 text-xs">{p.volumeMm3 ? `${(p.volumeMm3/1000).toFixed(2)} cm^3` : 'N/A'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20 text-xs" href={toFileUrl(p.filePath)} download>Download</a>
                    <Link className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20 text-xs" href={`/models/${model.id}?part=${i}`}>Preview</Link>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <a className="btn" href={`/api/models/${model.id}/download.zip`}>Download All</a>
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <a href={src} download className="btn">Download</a>
          {payload && (
            <form action={`/api/models/${model.id}/like`} method="post">
              <button className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20" formAction={`/api/models/${model.id}/like`}>Like</button>
            </form>
          )}
          {canEdit && (
            <Link href={`/models/${model.id}/edit`} className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20">Edit</Link>
          )}
        </div>
      </div>
    </div>
  )
}
