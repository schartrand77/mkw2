import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { BRAND_SLUG } from '@/lib/brand'
import { resolveBaseUrl } from '@/lib/base-url'
import FeaturedMarquee from '@/components/FeaturedMarquee'
import { prisma } from '@/lib/db'
import { toPublicHref } from '@/lib/storage'
import { serializeComment } from '@/lib/comments'
import { CACHE_TAGS, CACHE_TTL_SECONDS } from '@/lib/cache-policy'

export const revalidate = 120

async function fetchFeatured(baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/featured`, {
    next: {
      revalidate: CACHE_TTL_SECONDS.featuredModels,
      tags: [CACHE_TAGS.homePage, CACHE_TAGS.featuredModels],
    },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.models as any[]
}

type CuratedHomeComment = {
  id: string
  body: string
  modelId: string
  modelTitle: string
  userDisplayName: string
  userProfileSlug: string | null
  userAvatarUrl: string | null
}

const fetchCuratedComments = unstable_cache(async (): Promise<CuratedHomeComment[]> => {
  const curated = await prisma.modelComment.findMany({
    where: {
      type: 'comment',
      body: { not: '' },
      isHomeCurated: true,
      model: { visibility: 'public' },
    },
    orderBy: { createdAt: 'desc' },
    take: 12,
    include: {
      model: { select: { id: true, title: true } },
      user: {
        select: {
          id: true,
          name: true,
          profile: { select: { slug: true, avatarImagePath: true } },
        },
      },
    },
  } as any) as any[]

  const picked: CuratedHomeComment[] = []
  const seenUsers = new Set<string>()
  const seenModels = new Set<string>()

  for (const comment of curated) {
    const serialized = serializeComment(comment)
    const userId = serialized.user?.id || null
    const modelId = comment.model?.id || ''
    if (!serialized.body?.trim() || !modelId) continue
    if (userId && seenUsers.has(userId)) continue
    if (seenModels.has(modelId)) continue
    picked.push({
      id: serialized.id,
      body: serialized.body,
      modelId,
      modelTitle: comment.model?.title || 'Untitled model',
      userDisplayName: serialized.user?.displayName || 'Community maker',
      userProfileSlug: serialized.user?.profileSlug || null,
      userAvatarUrl: toPublicHref(serialized.user?.avatarUrl) || null,
    })
    if (userId) seenUsers.add(userId)
    seenModels.add(modelId)
    if (picked.length >= 3) break
  }

  return picked
}, ['home-curated-comments:v1'], {
  revalidate: CACHE_TTL_SECONDS.homeCuratedComments,
  tags: [CACHE_TAGS.homePage, CACHE_TAGS.homeCuratedComments],
})

export default async function HomePage() {
  const baseUrl = await resolveBaseUrl()
  const [featured, curatedComments] = await Promise.all([
    fetchFeatured(baseUrl),
    fetchCuratedComments(),
  ])
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
      {curatedComments.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-brand-300/80">Community</p>
              <h2 className="text-xl font-semibold mt-1">Curated model comments</h2>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {curatedComments.map((comment) => (
              <article key={comment.id} className="glass rounded-xl border border-white/10 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {comment.userAvatarUrl ? (
                    <img
                      src={comment.userAvatarUrl}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover border border-white/10"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center text-xs font-semibold border border-white/10">
                      {(comment.userDisplayName || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    {comment.userProfileSlug ? (
                      <Link href={`/u/${comment.userProfileSlug}`} className="block text-sm font-semibold truncate hover:underline">
                        {comment.userDisplayName}
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold truncate">{comment.userDisplayName}</p>
                    )}
                    <p className="text-xs text-slate-400">
                      on{' '}
                      <Link href={`/models/${comment.modelId}`} className="hover:text-white">
                        {comment.modelTitle}
                      </Link>
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-200 line-clamp-4 whitespace-pre-wrap">{comment.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}
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
