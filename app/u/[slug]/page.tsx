import { prisma } from '@/lib/db'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { buildImageSrc, toPublicHref } from '@/lib/storage'
import { resolveModelPrice } from '@/lib/pricing'

async function getProfile(slug: string) {
  return prisma.profile.findUnique({
    where: { slug },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          badges: { include: { achievement: true } },
        }
      }
    },
  })
}

async function getUserModels(userId: string) {
  const [models, cfg] = await Promise.all([
    prisma.model.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        coverImagePath: true,
        priceUsd: true,
        priceOverrideUsd: true,
        volumeMm3: true,
        material: true,
        updatedAt: true,
      },
    }),
    prisma.siteConfig.findUnique({ where: { id: 'main' } }),
  ])
  return models.map((m) => ({
    ...m,
    priceUsd: resolveModelPrice(m as any, cfg),
  }))
}

export default async function UserPage({ params }: { params: { slug: string } }) {
  const profile = await getProfile(params.slug)
  if (!profile) return <div>Profile not found</div>
  const models = await getUserModels(profile.userId)
  const token = cookies().get('mwv2_token')?.value
  const current = token ? verifyToken(token)?.sub : null
  const avatarSrc = toPublicHref(profile.avatarImagePath)
  const contactItems = [
    profile.contactEmail && { label: 'Email', value: profile.contactEmail, href: `mailto:${profile.contactEmail}` },
    profile.contactPhone && { label: 'Phone', value: profile.contactPhone, href: `tel:${profile.contactPhone.replace(/[^+0-9]/g, '')}` },
    profile.websiteUrl && { label: 'Website', value: profile.websiteUrl, href: profile.websiteUrl.startsWith('http') ? profile.websiteUrl : `https://${profile.websiteUrl}` },
  ].filter(Boolean) as { label: string, value: string, href?: string }[]

  const socials = [
    profile.socialInstagram && { label: 'Instagram', href: formatSocialUrl('instagram', profile.socialInstagram), display: cleanHandle(profile.socialInstagram) },
    profile.socialTwitter && { label: 'Twitter / X', href: formatSocialUrl('twitter', profile.socialTwitter), display: cleanHandle(profile.socialTwitter) },
    profile.socialTikTok && { label: 'TikTok', href: formatSocialUrl('tiktok', profile.socialTikTok), display: cleanHandle(profile.socialTikTok) },
    profile.socialYoutube && { label: 'YouTube', href: formatSocialUrl('youtube', profile.socialYoutube), display: cleanHandle(profile.socialYoutube) },
    profile.socialLinkedin && { label: 'LinkedIn', href: formatSocialUrl('linkedin', profile.socialLinkedin), display: cleanHandle(profile.socialLinkedin) },
    profile.socialFacebook && { label: 'Facebook', href: formatSocialUrl('facebook', profile.socialFacebook), display: cleanHandle(profile.socialFacebook) },
  ].filter((s) => s && s.href) as { label: string, href: string, display: string }[]

  return (
    <div className="space-y-8">
      <div className="glass rounded-xl p-6 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="w-24 h-24 rounded-full border border-white/10 bg-slate-900/40 overflow-hidden flex-shrink-0">
          {avatarSrc ? (
            <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
              No avatar
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold">{profile.user.name || profile.user.email}</h1>
            <p className="text-slate-400 text-sm">/{profile.slug}</p>
          </div>
          {profile.user.badges && profile.user.badges.length > 0 && (
            <div className="flex flex-wrap gap-2 text-sm">
              {profile.user.badges.map((ub: any) => (
                <span key={ub.achievementId} title={ub.achievement?.description || ''} className="px-2 py-1 rounded-md border border-white/10 bg-black/30">
                  <span className="mr-1">{ub.achievement?.icon || 'dY?+'}</span>
                  <span>{ub.achievement?.name}</span>
                </span>
              ))}
            </div>
          )}
          {profile.bio && <p className="text-slate-300 whitespace-pre-wrap">{profile.bio}</p>}
          {current === profile.userId && (
            <div>
              <Link href="/settings/profile" className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20">Edit profile</Link>
            </div>
          )}
        </div>
      </div>
      {(contactItems.length > 0 || socials.length > 0) && (
        <div className="glass rounded-xl p-6 space-y-4">
          {contactItems.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Contact</h2>
              <ul className="space-y-1 text-sm text-slate-300">
                {contactItems.map((item) => (
                  <li key={item.label}>
                    <span className="text-slate-500 mr-2 uppercase tracking-[0.25em] text-[10px]">{item.label}</span>
                    {item.href ? (
                      <a href={item.href} className="hover:underline">{item.value}</a>
                    ) : (
                      <span>{item.value}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {socials.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Social</h2>
              <div className="flex flex-wrap gap-2 text-sm">
                {socials.map((social) => (
                  <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20">
                    {social.label}: {social.display}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <section className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
        {models.length === 0 && <p className="text-slate-400">No models yet.</p>}
        {models.map((m) => (
          <Link key={m.id} href={`/models/${m.id}`} className="glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition">
            {m.coverImagePath ? (
              <img src={buildImageSrc(m.coverImagePath, m.updatedAt) || `/files${m.coverImagePath}`} alt={m.title} className="aspect-video w-full object-cover" />
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

function cleanHandle(value: string) {
  return value.startsWith('@') ? value : value.replace(/^https?:\/\//i, '')
}

function formatSocialUrl(kind: 'instagram' | 'twitter' | 'tiktok' | 'youtube' | 'linkedin' | 'facebook', value: string) {
  if (!value) return ''
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const handle = trimmed.replace(/^@/, '')
  switch (kind) {
    case 'instagram':
      return `https://instagram.com/${handle}`
    case 'twitter':
      return `https://twitter.com/${handle}`
    case 'tiktok':
      return `https://www.tiktok.com/@${handle}`
    case 'youtube':
      return `https://www.youtube.com/${handle}`
    case 'linkedin':
      return `https://www.linkedin.com/in/${handle}`
    case 'facebook':
      return `https://www.facebook.com/${handle}`
    default:
      return handle
  }
}
