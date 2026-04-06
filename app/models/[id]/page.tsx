import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildYouTubeEmbedUrl } from '@/lib/youtube'
import { buildImageSrc, toPublicHref } from '@/lib/storage'
import { resolveBaseUrl } from '@/lib/base-url'
import ModelPartsList from '@/components/ModelPartsList'
import ModelComments from '@/components/ModelComments'
import ModelShareButton from '@/components/ModelShareButton'
import InstantQuoteConfigurator from '@/components/InstantQuoteConfigurator'
import ModelProcessingNotifier from '@/components/ModelProcessingNotifier'
import PrintabilityChecksCard from '@/components/PrintabilityChecksCard'
import ModelReviewWorkspace from '@/components/ModelReviewWorkspace'
import CreatorQualityCard from '@/components/CreatorQualityCard'
import ModelLineageCard from '@/components/ModelLineageCard'
import { CACHE_TAGS, CACHE_TTL_SECONDS, modelCommentsTag, modelTag } from '@/lib/cache-policy'
import { needsModelPreviewConversion } from '@/lib/model-files'

function formatEnvelopeLabel(sizeXmm?: number | null, sizeYmm?: number | null, sizeZmm?: number | null) {
  const values = [sizeXmm, sizeYmm, sizeZmm]
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) return 'N/A'
  return `${Math.round(sizeXmm as number)} x ${Math.round(sizeYmm as number)} x ${Math.round(sizeZmm as number)} mm`
}

async function fetchModel(id: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/models/${id}`, {
    next: {
      revalidate: CACHE_TTL_SECONDS.modelDetail,
      tags: [modelTag(id), modelCommentsTag(id), CACHE_TAGS.discoverModels],
    },
  })
  if (!res.ok) return null
  return (await res.json()).model as any
}

type ModelDetailProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ [k: string]: string | string[] | undefined }>
}

export default async function ModelDetail({ params, searchParams }: ModelDetailProps) {
  const { id } = await params
  const baseUrl = await resolveBaseUrl()
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const model = await fetchModel(id, baseUrl)
  if (!model) return <div>Not found</div>
  const shareUrl = `${baseUrl}/models/${model.id}`
  const fileHref = toPublicHref(model.filePath)
  const filePath = typeof model.filePath === 'string' ? model.filePath : null
  const viewerPath = typeof model.viewerFilePath === 'string' ? model.viewerFilePath : null
  const viewerHref = toPublicHref(viewerPath || filePath)
  const viewerFallbackHref = null
  const coverHref = model.coverImageStatus === 'ready'
    ? buildImageSrc(model.coverImagePath, model.updatedAt)
    : null
  const hasParts = Array.isArray(model.parts) && model.parts.length > 0
  const downloadsEnabled = model.downloadsEnabled !== false
  const partParam = resolvedSearchParams?.part
  const partIndexRaw = Array.isArray(partParam) ? partParam[0] : partParam
  const partIndex = partIndexRaw != null ? Number.parseInt(String(partIndexRaw), 10) : NaN
  const initialGalleryKey = Number.isFinite(partIndex) && partIndex >= 0 && partIndex < (hasParts ? model.parts.length : 0)
    ? `three:${partIndex}`
    : 'three:all'
  const videoEmbedUrl = model.videoEmbedId ? buildYouTubeEmbedUrl(model.videoEmbedId) : null
  const affiliateHost = model.affiliateUrl ? (() => {
    try {
      const rawHost = new URL(model.affiliateUrl).hostname
      return rawHost.replace(/^www\./i, '') || 'external site'
    } catch {
      return 'external site'
    }
  })() : null
  const creditName = typeof model.creditName === 'string' ? model.creditName.trim() : ''
  const creditUrlRaw = typeof model.creditUrl === 'string' ? model.creditUrl.trim() : ''
  const creditUrlHref = creditUrlRaw ? (() => {
    try {
      return new URL(creditUrlRaw).toString()
    } catch {
      return ''
    }
  })() : ''
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  const me = payload?.sub ? await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } }) : null
  const canEdit = !!(payload?.sub && (payload.sub === model.userId || me?.isAdmin))
  const canModerateComments = !!me?.isAdmin
  const coverProcessing = model.coverImageStatus === 'processing'
  const galleryProcessing = Array.isArray(model.images)
    ? model.images.some((img: any) => img?.status === 'processing')
    : false
  const previewProcessing = typeof model.previewProcessing === 'boolean'
    ? model.previewProcessing
    : Array.isArray(model.parts)
      ? model.parts.some((part: any) => {
          const filePath = String(part.filePath || '').toLowerCase()
          const ext = filePath.includes('.') ? `.${filePath.split('.').pop()}` : ''
          return needsModelPreviewConversion(ext) && !part.previewFilePath
        })
      : false
  const isProcessing = coverProcessing || galleryProcessing || previewProcessing
  const reviewPins = Array.isArray(model.comments)
    ? model.comments
        .filter((comment: any) => comment?.partReview?.partId && comment?.partReview?.pin)
        .map((comment: any) => ({
          partKey: comment.partReview.partId,
          x: Number(comment.partReview.pin.x),
          y: Number(comment.partReview.pin.y),
          z: Number(comment.partReview.pin.z),
        }))
        .filter((pin: any) => [pin.x, pin.y, pin.z].every((value: number) => Number.isFinite(value)))
    : []
  const envelopeLabel = formatEnvelopeLabel(model.sizeXmm, model.sizeYmm, model.sizeZmm)
  const descriptionPreview = typeof model.description === 'string' && model.description.trim()
    ? model.description.trim().slice(0, 220)
    : 'No description provided yet.'
  return (
    <div className="max-w-[1500px] mx-auto min-w-0 space-y-5 px-4 sm:px-6">
      <div>
        <Link href="/discover" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <span aria-hidden="true">&larr;</span>
          Back to Discover
        </Link>
      </div>
      <section className="glass rounded-[1.75rem] border border-white/10 p-5 md:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)] lg:items-start">
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.34em] text-brand-300/80">Model workspace</p>
              <h1 className="text-3xl font-semibold break-words md:text-4xl">{model.title}</h1>
              <p className="max-w-3xl text-sm text-slate-300 md:text-base">
                {descriptionPreview}
                {typeof model.description === 'string' && model.description.trim().length > 220 ? '...' : ''}
              </p>
            </div>
            {model.tags && model.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {model.tags.map((t: any) => (
                  <Link key={t.slug} href={`/discover?tags=${t.slug}`} className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20 text-xs">#{t.name}</Link>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {downloadsEnabled ? (
                <a
                  href={hasParts ? `/api/models/${model.id}/download.zip` : (fileHref || '#')}
                  {...(!hasParts && fileHref ? { download: true } : {})}
                  className="btn"
                >
                  {hasParts ? 'Download All Parts (.zip)' : 'Download Model'}
                </a>
              ) : (
                <span className="px-3 py-2 rounded-md border border-amber-400/30 bg-amber-400/10 text-sm text-amber-200">
                  Downloads disabled
                </span>
              )}
              <a href="#quote-workspace" className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-sm">
                Jump to quote workspace
              </a>
              <ModelShareButton title={model.title} url={shareUrl} />
              {canEdit && (
                <Link href={`/models/${model.id}/edit`} className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20">Edit</Link>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Build envelope</p>
              <p className="mt-2 text-lg font-semibold text-white">{envelopeLabel}</p>
              <p className="mt-1 text-sm text-slate-400">Live quote scaling updates this target in the workspace below.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Material + file</p>
              <p className="mt-2 text-lg font-semibold text-white">{model.material || 'Material pending'}</p>
              <p className="mt-1 text-sm text-slate-400">{model.fileType || 'Unknown format'} • {model.volumeMm3 ? `${(model.volumeMm3 / 1000).toFixed(2)} cm^3` : 'Volume pending'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Review workflow</p>
              <p className="mt-2 text-base font-semibold text-white">{hasParts ? `${model.parts.length} part${model.parts.length === 1 ? '' : 's'}` : 'Single-part model'}</p>
              <p className="mt-1 text-sm text-slate-400">Inspect geometry on the left, then tune the quote and manufacturability settings on the right.</p>
            </div>
          </div>
        </div>
      </section>
      {canEdit && isProcessing && (
        <div className="glass rounded-xl p-4 text-sm text-slate-200 border border-amber-400/30">
          <div className="font-semibold text-amber-200">Processing uploads</div>
          <p className="text-slate-300 mt-1">
            {coverProcessing && previewProcessing
              ? 'Cover image and model previews are processing in the background.'
              : coverProcessing
                ? 'Cover image is processing in the background.'
                : galleryProcessing
                  ? 'Gallery photos are processing in the background.'
                  : 'Model previews are processing in the background.'}
            {' '}We will email you when everything is ready.
          </p>
        </div>
      )}
      {canEdit && (
        <ModelProcessingNotifier
          modelId={model.id}
          enabled={canEdit}
          initialCoverProcessing={coverProcessing}
          initialGalleryProcessing={galleryProcessing}
          initialPreviewProcessing={previewProcessing}
        />
      )}
      <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,440px)] gap-6 min-w-0 items-start">
        <div className="min-w-0 xl:sticky xl:top-24">
          <ModelReviewWorkspace
            modelId={model.id}
            coverSrc={coverHref}
            parts={hasParts ? model.parts.map((part: any, index: number) => ({
              id: part.id,
              name: part.name,
              index,
              filePath: part.filePath,
              previewFilePath: part.previewFilePath,
              sizeXmm: part.sizeXmm,
              sizeYmm: part.sizeYmm,
              sizeZmm: part.sizeZmm,
            })) : []}
            allSrc={viewerHref || null}
            allFallbackSrc={viewerFallbackHref}
            images={model.images || []}
            initialKey={initialGalleryKey}
            reviewPins={reviewPins}
            actions={payload ? (
              <form action={`/api/models/${model.id}/like`} method="post">
                <button className="px-3 py-2 rounded-md border border-white/10 bg-black/50 text-sm hover:border-white/30" formAction={`/api/models/${model.id}/like`}>Like</button>
              </form>
            ) : null}
          />
        </div>
        <div className="space-y-3 min-w-0">
        <section id="quote-workspace" className="glass rounded-[1.5rem] border border-white/10 p-4 md:p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-[0.34em] text-brand-300/80">Quote workspace</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Configure production-ready pricing.</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-300">
              Tune material, finish, tolerances, dimensions, and color slots in one place, then review manufacturability and lead-time confidence before adding to cart.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <a href="#model-comments-compose" className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:border-white/20">
              Jump to comments
            </a>
            <a href="#model-lineage" className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:border-white/20">
              Revision lineage
            </a>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Buyer flow</p>
            <p className="mt-2 text-sm text-slate-200">Review geometry, configure quote, export manufacturability PDF, then add to cart.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Confidence tools</p>
            <p className="mt-2 text-sm text-slate-200">Live feasibility scoring, material recommendations, and lead-time signals stay attached to the quote.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Part context</p>
            <p className="mt-2 text-sm text-slate-200">{hasParts ? 'Use part-aware review on the left to target feedback before locking the final configuration.' : 'Single-part review keeps geometry and quoting aligned in one surface.'}</p>
          </div>
        </div>
        {creditName && (
          <div className="glass rounded-xl p-4 text-sm text-slate-300">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">Credited creator</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-white">{creditName}</span>
              {creditUrlHref && (
                <a
                  href={creditUrlHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-300 hover:text-brand-200 underline underline-offset-2"
                >
                  View source
                </a>
              )}
            </div>
          </div>
        )}
        {model.creator?.quality ? (
          <CreatorQualityCard
            quality={model.creator.quality}
            profileSlug={model.creator.profileSlug}
            creatorName={model.creator.name || null}
          />
        ) : null}
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
        </div>
        {(model.printabilityScore != null || model.failureRiskScore != null || model.supportLikelihood != null) && (
          <PrintabilityChecksCard
            printabilityScore={model.printabilityScore}
            failureRiskScore={model.failureRiskScore}
            supportLikelihood={model.supportLikelihood}
            orientationSuggestion={model.orientationSuggestion}
            supportStrategySuggestion={model.supportStrategySuggestion}
            sizeXmm={model.sizeXmm}
            sizeYmm={model.sizeYmm}
            sizeZmm={model.sizeZmm}
          />
        )}
        <InstantQuoteConfigurator
          modelId={model.id}
          title={model.title}
          priceUsd={model.priceUsd}
          material={model.material}
          sizeXmm={model.sizeXmm}
          sizeYmm={model.sizeYmm}
          sizeZmm={model.sizeZmm}
          thumbnail={coverHref}
          defaultColors={Array.isArray(model.defaultColors) ? model.defaultColors : null}
          colorSlotCount={typeof model.colorSlotCount === 'number' ? model.colorSlotCount : null}
          allowedColors={Array.isArray(model.allowedColors) ? model.allowedColors : null}
          flatRatePricing={Boolean(model.flatRatePricing)}
          parts={hasParts ? model.parts.map((p: any, i: number) => ({
            id: p.id,
            name: p.name,
            index: typeof p.index === 'number' ? p.index : i,
            priceUsd: p.priceUsd,
            sizeXmm: p.sizeXmm,
            sizeYmm: p.sizeYmm,
            sizeZmm: p.sizeZmm,
          })) : []}
        />
        </section>
        {model.affiliateUrl && (
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Required parts</div>
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
                  Open on {affiliateHost || 'external site'}
                </a>
            </div>
          </div>
        )}
        {hasParts && (
          <ModelPartsList
            modelId={model.id}
            modelTitle={model.title}
            flatRatePricing={Boolean(model.flatRatePricing)}
            thumbnail={coverHref}
            downloadsEnabled={downloadsEnabled}
            colorSlotCount={typeof model.colorSlotCount === 'number' ? model.colorSlotCount : null}
            allowedColors={Array.isArray(model.allowedColors) ? model.allowedColors : null}
            defaultColors={Array.isArray(model.defaultColors) ? model.defaultColors : null}
            selectedPartIndex={Number.isFinite(partIndex) ? partIndex : null}
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
        <div id="model-lineage">
          <ModelLineageCard
            modelId={model.id}
            lineage={model.lineage || null}
            revisions={Array.isArray(model.revisions) ? model.revisions : []}
          />
        </div>
        {Array.isArray(model.revisions) && model.revisions.length > 0 && (
          <div className="glass rounded-xl p-4 space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Revision notes</div>
            <div className="space-y-3 text-sm text-slate-300">
              {model.revisions.map((rev: any) => (
                <div key={rev.id} className="rounded-lg border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">
                      v{rev.version}{rev.label ? ` - ${rev.label}` : ''}
                    </div>
                    <div className="text-xs text-slate-400">
                      {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                  {rev.note && <div className="text-xs text-slate-400 mt-1">{rev.note}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
      <ModelComments
        modelId={model.id}
        initialComments={model.comments || []}
        currentUserId={payload?.sub || null}
        canModerate={canModerateComments}
      />
    </div>
  )
}
