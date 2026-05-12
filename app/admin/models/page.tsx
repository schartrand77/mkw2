export const dynamic = 'force-dynamic'

import ModelManager from '@/components/admin/ModelManager'

type AdminModelsPageProps = {
  searchParams?: Promise<{ q?: string | string[] }>
}

export default async function AdminModelsPage({ searchParams }: AdminModelsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const q = Array.isArray(resolvedSearchParams.q) ? resolvedSearchParams.q[0] : resolvedSearchParams.q

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Model library</h1>
        <p className="mt-1 text-sm text-slate-400">Search, curate, and moderate uploaded models.</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
        <ModelManager initialQuery={q || ''} />
      </div>
    </div>
  )
}
