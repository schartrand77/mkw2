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

const valuePillars = [
  {
    title: 'Production-grade quoting',
    text: 'Real-time pricing, material logic, and route-aware fulfillment for serious manufacturing workflows.',
  },
  {
    title: 'Collaborative model pipeline',
    text: 'Upload, annotate, review, and iterate with teams without losing part history or context.',
  },
  {
    title: 'Operator visibility',
    text: 'Connectors, queue telemetry, and release health dashboards keep production predictable.',
  },
]

const CARD_CLASS = 'home-card'

function HomeHero() {
  return (
    <section className="home-hero rounded-3xl p-8 md:p-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-brand-200/80">MakerWorks v2</p>
          <h1 className="text-4xl md:text-5xl xl:text-6xl font-semibold tracking-tight text-balance">
            A modern print operations hub for design-to-delivery teams.
          </h1>
          <p className="max-w-2xl text-base md:text-lg text-slate-300">
            Upload faster, estimate with confidence, and ship quality parts through a single professional workspace.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/upload" className="btn">Start a new upload</Link>
            <Link href="/discover" className="home-ghost-btn">Explore model library</Link>
          </div>
        </div>
        <div className="home-hero-panel">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Platform focus</p>
          <ul className="mt-4 ml-5 list-disc space-y-3 text-sm text-slate-200 marker:text-brand-300/80">
            <li>Quoting + checkout continuity</li>
            <li>Governed publishing flow</li>
            <li>Predictable production handoff</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

function ValuePillars() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {valuePillars.map((pillar) => (
        <article key={pillar.title} className={CARD_CLASS}>
          <h2 className="text-base font-semibold">{pillar.title}</h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">{pillar.text}</p>
        </article>
      ))}
    </section>
  )
}

function ContactCta({ contactEmail }: { contactEmail: string }) {
  return (
    <section className="home-cta rounded-3xl p-8 md:p-10">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <h3 className="text-2xl font-semibold">Need a custom run or production support?</h3>
          <p className="text-slate-300 mt-2">
            Reach the MakerWorks team for fulfillment timelines, material guidance, and enterprise support.
          </p>
        </div>
        <a
          href={`mailto:${contactEmail}`}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-white/25 text-base font-medium tracking-wide hover:border-white/45"
        >
          {contactEmail}
        </a>
      </div>
    </section>
  )
}

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
    <div className="space-y-10 md:space-y-14">
      <HomeHero />
      <ValuePillars />

      {featured.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-brand-300/80">Featured</p>
              <h2 className="text-2xl font-semibold mt-1">Active spotlight models</h2>
            </div>
            <Link href="/discover" className="text-sm text-slate-400 hover:text-white transition">View all models</Link>
          </div>
          <FeaturedMarquee models={featured} />
        </section>
      ) : (
        <section className={`${CARD_CLASS} py-16 text-center`}>
          <p className="text-lg font-semibold">Featured models are being refreshed.</p>
          <p className="text-slate-400 mt-2">Browse the full catalog while the new spotlight set is prepared.</p>
          <Link href="/discover" className="btn mt-6">Open Discover</Link>
        </section>
      )}

      {curatedComments.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-brand-300/80">Community proof</p>
            <h2 className="text-2xl font-semibold mt-1">What makers are saying</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {curatedComments.map((comment) => (
              <article key={comment.id} className={`${CARD_CLASS} space-y-3`}>
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

      <ContactCta contactEmail={contactEmail} />
    </div>
  )
}
