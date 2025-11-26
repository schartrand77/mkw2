import Gallery from '@/components/Gallery'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency } from '@/lib/currency'
import { formatPriceLabel } from '@/lib/price-label'
import { buildYouTubeEmbedUrl } from '@/lib/youtube'
import { buildImageSrc, toPublicHref } from '@/lib/storage'
import { BRAND_NAME } from '@/lib/brand'
import ModelPartsList from '@/components/ModelPartsList'

async function fetchModel(id: string) {
  const res = await fetch(`${process.env.BASE_URL || ''}/api/models/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()).model as any
}

export default async function ModelDetail({ params, searchParams }: { params: { id: string }, searchParams?: { [k: string]: string | string[] | undefined } }) {
  const model = await fetchModel(params.id)
  if (!model) return <div>Not found</div>
  const fileHref = toPublicHref(model.filePath)
  const viewerHref = toPublicHref(model.viewerFilePath || model.filePath)
  const coverHref = buildImageSrc(model.coverImagePath, model.updatedAt)
  const hasParts = Array.isArray(model.parts) && model.parts.length > 0
  const partParam = searchParams?.part
  const partIndexRaw = Array.isArray(partParam) ? partParam[0] : partParam
  const partIndex = partIndexRaw != null ? Number.parseInt(String(partIndexRaw), 10) : NaN
  const initialGalleryKey = Number.isFinite(partIndex) && partIndex >= 0 && partIndex < (hasParts ? model.parts.length : 0)
    ? `three:${partIndex}`
    : undefined
  const videoEmbedUrl = model.videoEmbedId ? buildYouTubeEmbedUrl(model.videoEmbedId) : null
  const affiliateHost = model.affiliateUrl ? (() => {
    try {
      const rawHost = new URL(model.affiliateUrl).hostname
      return rawHost.replace(/^www\./i, '') || 'amazon.ca'
    } catch {
      return 'amazon.ca'
    }
  })() : null
  const affiliateImage = model.affiliateImage || null
  const onSale = model.salePriceUsd != null && model.basePriceUsd != null && model.salePriceUsd < model.basePriceUsd
  const priceLabel = formatPriceLabel(model.priceUsd, { from: model.salePriceIsFrom, unit: model.salePriceUnit })
  const token = cookies().get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  const me = payload?.sub ? await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } }) : null
  const canEdit = !!(payload?.sub && (payload.sub === model.userId || me?.isAdmin))
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <Link href="/discover" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <span aria-hidden="true">&larr;</span>
          Back to Discover
        </Link>
      </div>
      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <Gallery
            coverSrc={coverHref}
            parts={hasParts ? model.parts : []}
            allSrc={viewerHref || null}
            images={model.images || []}
            initialKey={initialGalleryKey}
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
          <div>
            {onSale && (
              <div className="text-xs text-rose-300">On sale</div>
            )}
            <div className="flex items-center gap-3">
              {onSale && model.basePriceUsd != null && (
                <span className="text-sm text-slate-400 line-through">
                  {formatCurrency(model.basePriceUsd)}
                </span>
              )}
              <span className="text-lg font-semibold">
                {priceLabel || 'N/A'}
              </span>
            </div>
            {model.pricing && (
              <p className="text-xs text-slate-400 mt-1">
                ≈ {model.pricing.grams} g · {model.pricing.hours} h @ {model.pricing.nozzleDiameterMm} mm ({model.pricing.printerProfile.label})
              </p>
            )}
          </div>
        </div>
        {model.affiliateUrl && (
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Required parts</div>
            <div className="flex flex-col sm:flex-row gap-4">
              {affiliateImage && (
                <a
                  href={model.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 inline-flex items-center justify-center"
                >
                  <img
                    src={affiliateImage}
                    alt={model.affiliateTitle ? `Amazon preview of ${model.affiliateTitle}` : 'Amazon preview'}
                    className="w-24 h-24 object-contain rounded-lg border border-white/10 bg-white/5 p-2"
                    loading="lazy"
                  />
                </a>
              )}
              <div className="space-y-2">
                <p className="text-lg font-semibold">{model.affiliateTitle || 'Recommended hardware'}</p>
                <p className="text-sm text-slate-300">
                  Link provided by the maker so you can grab the exact companion parts (springs, screws, electronics, etc.) this model expects.
                </p>
                <a
                  href={model.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn w-full md:w-auto text-center"
                >
                  Shop on {affiliateHost || 'Amazon'}
                </a>
                <p className="text-xs text-slate-500">
                  As an Amazon Associate, {BRAND_NAME} may earn from qualifying purchases. Pricing/availability updates instantly on Amazon.
                </p>
              </div>
            </div>
          </div>
        )}
        {hasParts && (
          <ModelPartsList
            modelId={model.id}
            modelTitle={model.title}
            thumbnail={coverHref}
            parts={model.parts.map((p: any, i: number) => ({
              id: p.id,
              name: p.name,
              volumeMm3: p.volumeMm3,
              priceUsd: p.priceUsd,
              pricing: p.pricing,
              downloadUrl: toPublicHref(p.filePath),
              index: i,
              sizeXmm: p.sizeXmm,
              sizeYmm: p.sizeYmm,
              sizeZmm: p.sizeZmm,
            }))}
          />
        )}
        <div className="flex gap-3">
          <a
            href={hasParts ? `/api/models/${model.id}/download.zip` : (fileHref || '#')}
            {...(!hasParts && fileHref ? { download: true } : {})}
            className="btn"
          >
            {hasParts ? 'Download All Parts (.zip)' : 'Download Model'}
          </a>
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
    </div>
  )
}
