import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { BRAND_NAME, BRAND_SLUG } from '@/lib/brand'
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

const metrics = [
  { value: '<2 min', label: 'to upload and quote' },
  { value: 'Part-aware', label: 'reviews and revisions' },
  { value: 'Live', label: 'production visibility' },
]

const featureLanes = [
  {
    eyebrow: 'Quote Intelligence',
    title: 'Price logic that feels engineered, not approximate.',
    copy: 'Surface cost drivers, confidence cues, and route-aware lead time before a buyer hesitates.',
  },
  {
    eyebrow: 'Team Workflow',
    title: 'Move from model review to approval without losing context.',
    copy: 'Workspaces, comments, and fulfillment handoff live in the same product instead of separate tools.',
  },
  {
    eyebrow: 'Production Signal',
    title: 'Admin telemetry that actually informs the customer experience.',
    copy: 'Queue health, manufacturability insight, and operational status feed a calmer ordering flow.',
  },
]

const releaseBullets = [
  'Editorial top-level navigation instead of the legacy left rail',
  'Command-deck interaction model for faster movement across the app',
  'Higher-contrast panels, layered lighting, and a more premium materials system',
]

function HomeHero() {
  return (
    <section className="home-hero">
      <div className="home-hero-grid">
        <div className="space-y-7">
          <div className="home-kicker-row">
            <span className="home-kicker">Next Gen Release</span>
            <span className="home-kicker home-kicker-muted">{BRAND_NAME} operating system for print teams</span>
          </div>

          <div className="space-y-5">
            <h1 className="home-display">
              A sharper, faster front end for serious 3D production.
            </h1>
            <p className="home-lead">
              From first upload to production handoff, the platform now reads like a premium operations cockpit instead of a legacy marketplace shell.
            </p>
          </div>

          <div className="home-hero-actions">
            <Link href="/upload" className="btn home-primary-cta">Start a new upload</Link>
            <Link href="/discover" className="home-ghost-btn">Explore model library</Link>
          </div>

          <div className="home-metrics-grid">
            {metrics.map((metric) => (
              <article key={metric.label} className="home-metric-card">
                <div className="home-metric-value">{metric.value}</div>
                <p className="home-metric-label">{metric.label}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="home-hero-stack">
          <article className="home-hero-panel home-hero-panel-primary">
            <p className="home-panel-label">Why this release feels different</p>
            <ul className="home-release-list">
              {releaseBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
          </article>

          <article className="home-hero-panel home-hero-panel-secondary">
            <div className="home-signal-topline">
              <span className="home-signal-dot" />
              <span>Production signal flowing</span>
            </div>
            <div className="home-signal-grid">
              <div>
                <p className="home-signal-value">03</p>
                <p className="home-signal-copy">active confidence systems</p>
              </div>
              <div>
                <p className="home-signal-value">24/7</p>
                <p className="home-signal-copy">operator visibility</p>
              </div>
              <div>
                <p className="home-signal-value">B2B</p>
                <p className="home-signal-copy">approval-grade workflows</p>
              </div>
              <div>
                <p className="home-signal-value">Live</p>
                <p className="home-signal-copy">quote and queue context</p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

function FeatureLanes() {
  return (
    <section className="space-y-5">
      <div className="home-section-heading">
        <p className="home-section-kicker">Platform pillars</p>
        <h2 className="home-section-title">Built like a production product, not a storefront theme.</h2>
      </div>
      <div className="home-lane-grid">
        {featureLanes.map((lane) => (
          <article key={lane.title} className="home-lane-card">
            <p className="home-lane-eyebrow">{lane.eyebrow}</p>
            <h3 className="home-lane-title">{lane.title}</h3>
            <p className="home-lane-copy">{lane.copy}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function ReleaseStrip() {
  return (
    <section className="home-release-strip">
      <div className="home-release-strip-copy">
        <p className="home-section-kicker">Release note</p>
        <h2 className="home-section-title">The interface now leads with control, confidence, and motion.</h2>
      </div>
      <div className="home-release-strip-tags">
        <span>Command deck</span>
        <span>Premium surfaces</span>
        <span>Editorial hierarchy</span>
        <span>Mobile drawer</span>
      </div>
    </section>
  )
}

function ContactCta({ contactEmail }: { contactEmail: string }) {
  return (
    <section className="home-cta">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="home-section-kicker">Custom runs</p>
          <h3 className="home-section-title">Need material guidance, timeline planning, or enterprise support?</h3>
          <p className="home-cta-copy">
            Reach the {BRAND_NAME} team for production timelines, procurement help, and specialized print workflows.
          </p>
        </div>
        <a href={`mailto:${contactEmail}`} className="home-cta-link">
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
    <div className="home-page">
      <HomeHero />
      <ReleaseStrip />
      <FeatureLanes />

      {featured.length > 0 ? (
        <section className="space-y-5">
          <div className="home-section-heading home-section-heading-inline">
            <div>
              <p className="home-section-kicker">Featured</p>
              <h2 className="home-section-title">Active spotlight models</h2>
            </div>
            <Link href="/discover" className="home-inline-link">View all models</Link>
          </div>
          <FeaturedMarquee models={featured} />
        </section>
      ) : (
        <section className="home-lane-card py-14 text-center">
          <p className="text-lg font-semibold text-white">Featured models are being refreshed.</p>
          <p className="mt-2 text-sm text-slate-300">Browse the full catalog while the new spotlight set is prepared.</p>
          <div className="mt-6">
            <Link href="/discover" className="btn">Open Discover</Link>
          </div>
        </section>
      )}

      {curatedComments.length > 0 && (
        <section className="space-y-5">
          <div className="home-section-heading">
            <p className="home-section-kicker">Community proof</p>
            <h2 className="home-section-title">What makers are saying</h2>
          </div>
          <div className="home-testimonial-grid">
            {curatedComments.map((comment) => (
              <article key={comment.id} className="home-testimonial-card">
                <div className="flex items-center gap-3">
                  {comment.userAvatarUrl ? (
                    <img
                      src={comment.userAvatarUrl}
                      alt=""
                      className="h-11 w-11 rounded-full border border-white/10 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold text-white">
                      {(comment.userDisplayName || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    {comment.userProfileSlug ? (
                      <Link href={`/u/${comment.userProfileSlug}`} className="block truncate text-sm font-semibold text-white hover:underline">
                        {comment.userDisplayName}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-semibold text-white">{comment.userDisplayName}</p>
                    )}
                    <p className="text-xs text-slate-400">
                      on <Link href={`/models/${comment.modelId}`} className="hover:text-white">{comment.modelTitle}</Link>
                    </p>
                  </div>
                </div>
                <p className="home-testimonial-copy">{comment.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <ContactCta contactEmail={contactEmail} />
    </div>
  )
}
