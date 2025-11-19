import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { buildImageSrc } from '@/lib/public-path'

async function getLiked(userId: string) {
  const likes = await prisma.like.findMany({
    where: { userId },
    include: { model: true },
    orderBy: { createdAt: 'desc' },
    take: 100
  })
  return likes.map(l => l.model)
}

export default async function LikedPage() {
  const userId = await getUserIdFromCookie()
  if (!userId) redirect('/login')
  const models = await getLiked(userId)
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Liked Models</h1>
      <section className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
        {models.length === 0 && <p className="text-slate-400">You haven't liked any models yet.</p>}
        {models.map((m: any) => (
          <Link key={m.id} href={`/models/${m.id}`} className="glass rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition">
            {m.coverImagePath ? (
              <img src={buildImageSrc(m.coverImagePath, m.updatedAt) || `/files${m.coverImagePath}`} alt={m.title} className="aspect-video w-full object-cover" />
            ) : (
              <div className="aspect-video w-full bg-slate-900/60 flex items-center justify-center text-slate-400">No image</div>
            )}
            <div className="p-4">
              <h3 className="font-semibold">{m.title}</h3>
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
