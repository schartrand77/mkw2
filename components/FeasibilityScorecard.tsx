import type { FeasibilityScorecard } from '@/lib/feasibility-scorecard'

type Props = {
  scorecard: FeasibilityScorecard
}

function formatSignalValue(value: number) {
  if (!Number.isFinite(value)) return 'N/A'
  return String(Math.round(value))
}

export default function FeasibilityScorecard({ scorecard }: Props) {
  const tone = scorecard.score >= 78
    ? 'border-emerald-400/30 bg-emerald-500/10'
    : scorecard.score >= 58
      ? 'border-amber-400/30 bg-amber-500/10'
      : 'border-rose-400/30 bg-rose-500/10'

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Print feasibility</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-white">{scorecard.score}</span>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-300">{scorecard.tier}</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-slate-200">{scorecard.summary}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {scorecard.signals.map((signal) => (
          <div key={signal.label} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{signal.label}</span>
              <span className="text-sm font-medium text-white">{formatSignalValue(signal.value)}</span>
            </div>
            <div className="mt-1 text-xs text-slate-300">{signal.summary}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
