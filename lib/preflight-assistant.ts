import { normalizeMaterialName } from '@/lib/cartPricing'

export type PreflightSuggestion = {
  id: string
  title: string
  action: string
  reason: string
  confidence: number
  priority: 'high' | 'medium' | 'low'
}

export type PreflightAssistantInput = {
  material?: string | null
  finish?: string | null
  toleranceClass?: string | null
  printabilityScore?: number | null
  failureRiskScore?: number | null
  supportLikelihood?: number | null
  orientationSuggestion?: string | null
  leadTimeHours?: number | null
  etaConfidenceScore?: number | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  scale?: number | null
  targetDimensions?: { x?: number; y?: number; z?: number } | null
}

export type PreflightAssistantResult = {
  summary: string
  confidence: number
  suggestions: PreflightSuggestion[]
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function largestDimension(input: PreflightAssistantInput) {
  const dimensions = [
    input.targetDimensions?.x ?? input.sizeXmm ?? null,
    input.targetDimensions?.y ?? input.sizeYmm ?? null,
    input.targetDimensions?.z ?? input.sizeZmm ?? null,
  ]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return dimensions.length > 0 ? Math.max(...dimensions) : null
}

export function buildPreflightAssistant(input: PreflightAssistantInput): PreflightAssistantResult {
  const suggestions: PreflightSuggestion[] = []
  const risk = typeof input.failureRiskScore === 'number' ? input.failureRiskScore : null
  const printability = typeof input.printabilityScore === 'number' ? input.printabilityScore : null
  const support = typeof input.supportLikelihood === 'number' ? input.supportLikelihood : null
  const etaConfidence = typeof input.etaConfidenceScore === 'number' ? input.etaConfidenceScore : null
  const material = normalizeMaterialName(input.material || 'PLA')
  const largest = largestDimension(input)

  if (risk != null && risk >= 60) {
    suggestions.push({
      id: 'reduce-risk',
      title: 'Reduce failure risk before production',
      action: 'Switch to a more forgiving setup: standard tolerance, standard finish, and the recommended orientation.',
      reason: `Current failure-risk estimate is ${risk}%, which is high for a first-pass print.`,
      confidence: 0.9,
      priority: 'high',
    })
  }

  if (support != null && support >= 0.5) {
    suggestions.push({
      id: 'support-strategy',
      title: 'Lower support cleanup burden',
      action: 'Use the recommended orientation and avoid cosmetic faces on heavy-support surfaces.',
      reason: `Support likelihood is ${Math.round(support * 100)}%, so support cleanup is likely to dominate print quality.`,
      confidence: 0.84,
      priority: support >= 0.7 ? 'high' : 'medium',
    })
  }

  if (printability != null && printability <= 65) {
    suggestions.push({
      id: 'geometry-review',
      title: 'Review geometry before committing',
      action: 'Keep scale conservative and verify overhang-heavy features in the model review workspace.',
      reason: `Printability score is ${printability}/100, which suggests setup sensitivity.`,
      confidence: 0.82,
      priority: printability < 50 ? 'high' : 'medium',
    })
  }

  if (largest != null && largest >= 180) {
    suggestions.push({
      id: 'machine-fit',
      title: 'Protect machine fit and stability',
      action: 'Avoid scaling larger unless needed, or split the part if you need more bed margin.',
      reason: `The current max span is about ${Math.round(largest)} mm, which reduces machine flexibility and bed margin.`,
      confidence: 0.79,
      priority: largest >= 230 ? 'high' : 'medium',
    })
  }

  if (material === 'PLA' && risk != null && risk >= 45) {
    suggestions.push({
      id: 'material-upgrade',
      title: 'Consider a more forgiving material',
      action: 'Try PETG for better durability and more stable functional output if appearance is secondary.',
      reason: 'PLA keeps cost low, but the current geometry/risk profile may benefit from a tougher material.',
      confidence: 0.72,
      priority: 'medium',
    })
  }

  if ((input.toleranceClass || 'standard') === 'fit_critical' && risk != null && risk >= 35) {
    suggestions.push({
      id: 'tolerance-reset',
      title: 'De-risk tight tolerance setup',
      action: 'Prototype once at standard tolerance before locking fit-critical settings for production.',
      reason: 'Fit-critical settings raise process sensitivity on a part that already shows non-trivial risk.',
      confidence: 0.77,
      priority: 'medium',
    })
  }

  if ((input.finish || 'standard').toLowerCase() !== 'standard' && input.leadTimeHours != null && input.leadTimeHours >= 24) {
    suggestions.push({
      id: 'finish-tradeoff',
      title: 'Trade finish quality against lead time',
      action: 'Return to standard finish if you need a faster turnaround or lower post-processing load.',
      reason: 'Custom finish requests increase post-process time on an already long-running job.',
      confidence: 0.7,
      priority: 'low',
    })
  }

  if (etaConfidence != null && etaConfidence < 0.65) {
    suggestions.push({
      id: 'eta-confidence',
      title: 'Increase schedule confidence',
      action: 'Prefer common materials and avoid rush settings if this part must land on a predictable ETA.',
      reason: `ETA confidence is ${Math.round(etaConfidence * 100)}%, so queue/material uncertainty is still elevated.`,
      confidence: 0.74,
      priority: 'medium',
    })
  }

  if (input.orientationSuggestion && suggestions.every((entry) => entry.id !== 'support-strategy')) {
    suggestions.push({
      id: 'orientation-confirm',
      title: 'Confirm the recommended build orientation',
      action: input.orientationSuggestion,
      reason: 'Orientation is still the cheapest lever for reducing support, wobble, and first-layer instability.',
      confidence: 0.68,
      priority: 'low',
    })
  }

  const deduped = suggestions
    .sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 }
      return priorityWeight[b.priority] - priorityWeight[a.priority] || b.confidence - a.confidence
    })
    .slice(0, 4)

  const averageConfidence = deduped.length > 0
    ? clamp(deduped.reduce((sum, item) => sum + item.confidence, 0) / deduped.length)
    : 0.66

  const summary = deduped.length === 0
    ? 'Preflight looks stable. The current setup appears production-ready without obvious remediation steps.'
    : deduped.some((entry) => entry.priority === 'high')
      ? 'Preflight found setup changes worth making before committing this job to production.'
      : 'Preflight found a few optimizations that could improve repeatability, lead time, or cleanup effort.'

  return {
    summary,
    confidence: Number(averageConfidence.toFixed(2)),
    suggestions: deduped,
  }
}
