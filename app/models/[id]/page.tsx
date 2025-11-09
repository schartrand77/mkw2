import ModelViewer from '@/components/ModelViewer'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

async function fetchModel(id: string) {
  const res = await fetch(`${process.env.BASE_URL || ''}/api/models/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()).model as any
}

export default async function ModelDetail({ params }: { params: { id: string } }) {
  const model = await fetchModel(params.id)
  if (!model) return <div>Not found</div>
  const src = model.filePath ? `/files${model.filePath}` : ''
  const isStl = model.fileType === 'STL'
  const token = cookies().get('mwv2_token')?.value
  const authed = token ? verifyToken(token) : null
  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div>
        {isStl ? (
          <ModelViewer src={src} />
        ) : model.coverImagePath ? (
          <img src={`/files${model.coverImagePath}`} alt={model.title} className="w-full rounded-xl border border-white/10" />
        ) : (
          <div className="aspect-video w-full bg-slate-900/60 flex items-center justify-center text-slate-400 rounded-xl border border-white/10">No preview</div>
        )}
      </div>
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">{model.title}</h1>
        <p className="text-slate-300 whitespace-pre-wrap">{model.description || 'No description provided.'}</p>
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
        <div className="flex gap-3">
          <a href={src} download className="btn">Download</a>
          {authed && (
            <form action={`/api/models/${model.id}/like`} method="post">
              <button className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20" formAction={`/api/models/${model.id}/like`}>❤ Like</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
