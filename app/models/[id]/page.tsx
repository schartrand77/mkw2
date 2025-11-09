import Gallery from '@/components/Gallery'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'

async function fetchModel(id: string) {
  const res = await fetch(`${process.env.BASE_URL || ''}/api/models/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()).model as any
}

export default async function ModelDetail({ params, searchParams }: { params: { id: string }, searchParams?: { [k: string]: string | string[] | undefined } }) {
  const model = await fetchModel(params.id)
  if (!model) return <div>Not found</div>
  const src = model.filePath ? `/files${model.filePath}` : ''
  const hasParts = Array.isArray(model.parts) && model.parts.length > 0
  const token = cookies().get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  const me = payload?.sub ? await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } }) : null
  const canEdit = !!(payload?.sub && (payload.sub === model.userId || me?.isAdmin))
  return (
    <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-8">
      <div>
        <Gallery
          coverSrc={model.coverImagePath ? `/files${model.coverImagePath}` : null}
          parts={hasParts ? model.parts : []}
          allSrc={src || null}
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
        <div className="glass rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
          <div className="text-slate-400">Material</div>
          <div>{model.material}</div>
          <div className="text-slate-400">File Type</div>
          <div>{model.fileType}</div>
          <div className="text-slate-400">Volume</div>
          <div>{model.volumeMm3 ? `${(model.volumeMm3/1000).toFixed(2)} cm³` : 'N/A'}</div>
          <div className="text-slate-400">Estimated Price</div>
          <div>{model.priceUsd ? `$${model.priceUsd.toFixed(2)}` : 'N/A'}</div>
        </div>
        {hasParts && (
          <div className="glass rounded-xl p-4 text-sm">
            <div className="font-semibold mb-2">Parts breakdown</div>
            <ul className="divide-y divide-white/10">
              {model.parts.map((p: any, i: number) => (
                <li key={p.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-slate-400 text-xs">{p.volumeMm3 ? `${(p.volumeMm3/1000).toFixed(2)} cm³` : 'N/A'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20 text-xs" href={`/files${p.filePath}`} download>Download</a>
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
              <button className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20" formAction={`/api/models/${model.id}/like`}>❤ Like</button>
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
