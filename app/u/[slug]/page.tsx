import { prisma } from '@/lib/db'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

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
  return prisma.model.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, coverImagePath: true, priceUsd: true },
  })
}

export default async function UserPage({ params }: { params: { slug: string } }) {
  const profile = await getProfile(params.slug)
  if (!profile) return <div>Profile not found</div>
  const models = await getUserModels(profile.userId)
  const token = cookies().get('mwv2_token')?.value
  const current = token ? verifyToken(token)?.sub : null
  return (
    <div className="space-y-8">
      <div className="glass rounded-xl p-6">
        <h1 className="text-2xl font-semibold">{profile.user.name || profile.user.email}</h1>
        <p className="text-slate-400 text-sm">/{profile.slug}</p>
        {profile.user.badges && profile.user.badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {profile.user.badges.map((ub: any) => (
              <span key={ub.achievementId} title={ub.achievement?.description || ''} className="px-2 py-1 rounded-md border border-white/10 bg-black/30">
                <span className="mr-1">{ub.achievement?.icon || '🏆'}</span>
                <span>{ub.achievement?.name}</span>
              </span>
            ))}
          </div>
        )}
        {profile.bio && <p className="mt-3 text-slate-300 whitespace-pre-wrap">{profile.bio}</p>}
        {current === profile.userId && (
          <div className="mt-4">
            <Link href="/settings/profile" className="px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20">Edit profile</Link>
          </div>
        )}
      </div>
      <section className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
        {models.length === 0 && <p className="text-slate-400">No models yet.</p>}
        {models.map((m) => (
          <Link key={m.id} href={`/models/${m.id}`} className="glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition">
            {m.coverImagePath ? (
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
