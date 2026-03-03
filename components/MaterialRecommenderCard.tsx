import type { MaterialRecommendation } from '@/lib/material-recommender'

type Props = {
  recommendations: MaterialRecommendation[]
  currentMaterial: string
  onSelect?: (material: string) => void
}

export default function MaterialRecommenderCard({ recommendations, currentMaterial, onSelect }: Props) {
  if (recommendations.length === 0) return null

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Material recommender</div>
        <p className="mt-1 text-sm text-slate-300">Tradeoff-aware suggestions based on durability, heat, UV, flexibility, and budget preferences.</p>
      </div>
      <div className="space-y-2">
        {recommendations.map((recommendation) => (
          <div key={recommendation.material} className="rounded-lg border border-white/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-white">
                  {recommendation.material}
                  {recommendation.material === currentMaterial ? ' • current' : ''}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-300">
                  {recommendation.reasons.map((reason) => (
                    <span key={reason} className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">{reason}</span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Score</div>
                <div className="text-lg font-semibold text-white">{recommendation.score}</div>
              </div>
            </div>
            {onSelect && recommendation.material !== currentMaterial ? (
              <button
                type="button"
                onClick={() => onSelect(recommendation.material)}
                className="mt-3 rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:border-white/20"
              >
                Switch to {recommendation.material}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
