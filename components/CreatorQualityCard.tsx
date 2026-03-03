import Link from 'next/link'
import type { CreatorQualitySnapshot } from '@/lib/creator-quality'

type Props = {
  quality: CreatorQualitySnapshot
  profileSlug?: string | null
  creatorName?: string | null
}

function toneClasses(score: number) {
  if (score >= 85) return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
  if (score >= 70) return 'border-sky-400/30 bg-sky-500/10 text-sky-100'
  if (score >= 55) return 'border-amber-400/30 bg-amber-500/10 text-amber-100'
  return 'border-white/10 bg-black/20 text-slate-100'
}

export default function CreatorQualityCard({ quality, profileSlug, creatorName }: Props) {
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${toneClasses(quality.score)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Creator quality</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold">{quality.score}</span>
            <span className="text-sm uppercase tracking-[0.2em] text-slate-400">{quality.tier}</span>
          </div>
        </div>
        {profileSlug ? (
          <Link href={`/u/${profileSlug}`} className="text-xs text-brand-300 hover:text-brand-200 underline underline-offset-2">
            View profile
          </Link>
        ) : null}
      </div>
      <p className="text-sm text-slate-300">
        {creatorName ? `${creatorName}: ` : ''}
        {quality.summary}
      </p>
      <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
        <div>
          <div className="text-slate-500">Successful prints</div>
          <div className="mt-1 text-sm font-medium">{quality.successfulPrints}</div>
        </div>
        <div>
          <div className="text-slate-500">Failure rate</div>
          <div className="mt-1 text-sm font-medium">{Math.round(quality.failureRate * 100)}%</div>
        </div>
        <div>
          <div className="text-slate-500">Verified reviews</div>
          <div className="mt-1 text-sm font-medium">{quality.verifiedReviewCount}</div>
        </div>
        <div>
          <div className="text-slate-500">Downloads</div>
          <div className="mt-1 text-sm font-medium">{quality.totalDownloads}</div>
        </div>
      </div>
    </div>
  )
}
