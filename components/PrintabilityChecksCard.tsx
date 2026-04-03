type Props = {
  printabilityScore?: number | null
  failureRiskScore?: number | null
  supportLikelihood?: number | null
  orientationSuggestion?: string | null
  supportStrategySuggestion?: string | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
}

function resolveRiskTier(score?: number | null) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return { label: 'Unknown', tone: 'text-slate-300' }
  if (score >= 65) return { label: 'High', tone: 'text-rose-300' }
  if (score >= 35) return { label: 'Medium', tone: 'text-amber-200' }
  return { label: 'Low', tone: 'text-emerald-300' }
}

function resolvePrintabilityTone(score?: number | null) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'text-slate-300'
  if (score >= 80) return 'text-emerald-300'
  if (score >= 60) return 'text-amber-200'
  return 'text-rose-300'
}

export default function PrintabilityChecksCard({
  printabilityScore,
  failureRiskScore,
  supportLikelihood,
  orientationSuggestion,
  supportStrategySuggestion,
  sizeXmm,
  sizeYmm,
  sizeZmm,
}: Props) {
  const risk = resolveRiskTier(failureRiskScore)
  const printabilityTone = resolvePrintabilityTone(printabilityScore)
  const largestDimension = [sizeXmm, sizeYmm, sizeZmm]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => b - a)[0]

  return (
    <div className="glass rounded-xl p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Printability checks</div>
          <p className="text-slate-300 mt-1">A buyer-facing manufacturability summary before checkout.</p>
        </div>
        <div className="text-xs text-slate-500">Use the quote configurator below to export the full PDF.</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="text-slate-500">Printability score</div>
          <div className={`mt-1 text-lg font-semibold ${printabilityTone}`}>
            {printabilityScore != null ? `${printabilityScore}/100` : 'N/A'}
          </div>
          <div className="text-slate-400 mt-1">Higher is easier to print repeatably.</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="text-slate-500">Estimated failure risk</div>
          <div className={`mt-1 text-lg font-semibold ${risk.tone}`}>
            {failureRiskScore != null ? `${failureRiskScore}%` : 'N/A'} {failureRiskScore != null ? `• ${risk.label}` : ''}
          </div>
          <div className="text-slate-400 mt-1">Lower is safer for first-pass production.</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="text-slate-500">Support burden</div>
          <div className="mt-1 text-white font-medium">
            {supportLikelihood != null ? `${Math.round(supportLikelihood * 100)}% likely` : 'N/A'}
          </div>
          <div className="text-slate-400 mt-1">
            {supportLikelihood != null && supportLikelihood >= 0.5
              ? 'Expect support cleanup and longer post-processing.'
              : 'Likely manageable with lighter support settings.'}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="text-slate-500">Bed fit hint</div>
          <div className="mt-1 text-white font-medium">
            {largestDimension ? `${Math.round(largestDimension)} mm max span` : 'Dimensions pending'}
          </div>
          <div className="text-slate-400 mt-1">Orientation and machine selection may change if you scale it up.</div>
        </div>
      </div>
      {(orientationSuggestion || supportStrategySuggestion) && (
        <div className="space-y-2">
          {orientationSuggestion && (
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-300">
              <span className="text-slate-500">Orientation:</span> {orientationSuggestion}
            </div>
          )}
          {supportStrategySuggestion && (
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-300">
              <span className="text-slate-500">Fix suggestion:</span> {supportStrategySuggestion}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
