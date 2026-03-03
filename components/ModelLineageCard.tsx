import Link from 'next/link'
import type { ModelLineageSummary } from '@/lib/model-lineage'

type RevisionSummary = {
  id: string
  version: number
  label?: string | null
  note?: string | null
  createdAt?: string | Date | null
}

type Props = {
  modelId: string
  lineage: ModelLineageSummary | null
  revisions: RevisionSummary[]
}

function formatDate(value?: string | Date | null) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString()
}

export default function ModelLineageCard({ modelId, lineage, revisions }: Props) {
  const hasOrigin = Boolean(lineage?.origin)
  const hasRemixes = Boolean(lineage?.remixes?.length)
  const hasRevisions = revisions.length > 0

  if (!hasOrigin && !hasRemixes && !hasRevisions) return null

  return (
    <div className="glass rounded-xl p-4 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Lineage</div>
        <p className="mt-1 text-sm text-slate-300">Track where this model came from, how it evolved, and what it spawned.</p>
      </div>
      <div className="space-y-3 text-sm">
        {lineage?.origin ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Based on</div>
            <Link href={`/models/${lineage.origin.id}`} className="mt-1 block font-semibold text-white hover:text-brand-200">
              {lineage.origin.title}
            </Link>
            {lineage.origin.creatorName ? (
              <div className="text-xs text-slate-400">
                by {lineage.origin.slug ? <Link href={`/u/${lineage.origin.slug}`} className="hover:text-white">{lineage.origin.creatorName}</Link> : lineage.origin.creatorName}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="rounded-lg border border-brand-400/30 bg-brand-500/10 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-brand-200/80">Current</div>
          <Link href={`/models/${modelId}`} className="mt-1 block font-semibold text-white hover:text-brand-100">
            This model
          </Link>
          <div className="text-xs text-slate-300">{revisions.length} revision{revisions.length === 1 ? '' : 's'} tracked</div>
        </div>
        {lineage?.remixes?.length ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Remixes / descendants</div>
            <div className="mt-2 space-y-2">
              {lineage.remixes.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3">
                  <div>
                    <Link href={`/models/${entry.id}`} className="font-medium text-white hover:text-brand-200">
                      {entry.title}
                    </Link>
                    <div className="text-xs text-slate-400">
                      {entry.creatorName || 'Unknown creator'} • {formatDate(entry.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {revisions.length > 0 ? (
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Revision trail</div>
            <div className="mt-2 space-y-2">
              {revisions.slice(0, 5).map((revision) => (
                <div key={revision.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">v{revision.version}{revision.label ? ` • ${revision.label}` : ''}</div>
                    {revision.note ? <div className="text-xs text-slate-400">{revision.note}</div> : null}
                  </div>
                  <div className="text-xs text-slate-500">{formatDate(revision.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
