type Inputs = {
  material?: string | null
  printabilityScore?: number | null
  failureRiskScore?: number | null
  supportLikelihood?: number | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
}

export type FeasibilityScorecard = {
  score: number
  tier: 'Production Ready' | 'Needs Review' | 'High Attention'
  signals: Array<{ label: string; value: number; summary: string }>
  summary: string
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

export function buildFeasibilityScorecard(input: Inputs): FeasibilityScorecard {
  const geometryScore = typeof input.printabilityScore === 'number'
    ? clamp(input.printabilityScore)
    : 60
  const failureReliability = typeof input.failureRiskScore === 'number'
    ? clamp(100 - input.failureRiskScore)
    : 55
  const supportBurden = typeof input.supportLikelihood === 'number'
    ? clamp(100 - (input.supportLikelihood * 100))
    : 60
  const largestDimension = [input.sizeXmm, input.sizeYmm, input.sizeZmm]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => b - a)[0] || 0
  const machineFit = largestDimension > 0 ? clamp(100 - Math.max(0, largestDimension - 180) * 0.35) : 70

  const score = Math.round((geometryScore * 0.35) + (failureReliability * 0.3) + (supportBurden * 0.2) + (machineFit * 0.15))
  const tier = score >= 78 ? 'Production Ready' : score >= 58 ? 'Needs Review' : 'High Attention'
  const summary = tier === 'Production Ready'
    ? 'Geometry, support burden, and machine fit suggest a repeatable first-pass print.'
    : tier === 'Needs Review'
      ? 'Printable, but setup choices and post-processing strategy still matter.'
      : 'This job likely needs closer operator review before committing to production.'

  return {
    score,
    tier,
    summary,
    signals: [
      { label: 'Geometry', value: geometryScore, summary: 'How stable the shape looks for repeatable printing.' },
      { label: 'Reliability', value: failureReliability, summary: 'Historical risk estimate converted into a confidence score.' },
      { label: 'Support', value: supportBurden, summary: 'Higher means less support cleanup and fewer fragile touchpoints.' },
      { label: 'Machine fit', value: machineFit, summary: 'Penalizes larger spans that reduce bed/machine flexibility.' },
    ],
  }
}
