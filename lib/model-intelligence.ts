type IntelligenceInputs = {
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  volumeMm3?: number | null
  supportRatio?: number | null
}

export type ModelIntelligence = {
  printabilityScore: number
  supportLikelihood: number
  failureRiskScore: number
  orientationSuggestion: string
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function resolveDims(inputs: IntelligenceInputs) {
  const dims = [inputs.sizeXmm, inputs.sizeYmm, inputs.sizeZmm]
    .map((d) => (d != null && Number.isFinite(Number(d)) ? Number(d) : null))
    .filter((d): d is number => d != null && d > 0)
  if (dims.length < 3) return null
  const [x, y, z] = dims
  const maxDim = Math.max(x, y, z)
  const minDim = Math.min(x, y, z)
  const midDim = x + y + z - maxDim - minDim
  return { x, y, z, maxDim, minDim, midDim }
}

function orientationSuggestion(dims: { x: number; y: number; z: number }) {
  const entries = [
    { axis: 'X', value: dims.x },
    { axis: 'Y', value: dims.y },
    { axis: 'Z', value: dims.z },
  ].sort((a, b) => a.value - b.value)
  const smallest = entries[0]
  const bedAxes = entries.slice(1).map((entry) => entry.axis).join('×')
  return `Lay ${smallest.axis} as height to maximize ${bedAxes} bed contact.`
}

export function computeModelIntelligence(inputs: IntelligenceInputs): ModelIntelligence | null {
  const dims = resolveDims(inputs)
  if (!dims) return null

  const supportRatioRaw = inputs.supportRatio != null && Number.isFinite(Number(inputs.supportRatio))
    ? Number(inputs.supportRatio)
    : null
  const supportLikelihood = supportRatioRaw != null
    ? clamp(supportRatioRaw)
    : clamp((dims.z / Math.max(dims.x, dims.y)) * 0.35)

  const aspect = dims.maxDim / Math.max(1, dims.minDim)
  const tallness = dims.z / Math.max(1, Math.min(dims.x, dims.y))
  const aspectPenalty = clamp((aspect - 1) / 6) * 30
  const supportPenalty = clamp(supportLikelihood) * 40
  const tallnessPenalty = clamp((tallness - 1) / 4) * 30
  const printabilityScore = Math.max(0, Math.round(100 - aspectPenalty - supportPenalty - tallnessPenalty))

  const normalizedTallness = clamp((tallness - 1) / 4)
  const normalizedAspect = clamp((aspect - 1) / 6)
  const failureRiskScore = Math.round(clamp((supportLikelihood * 0.5) + (normalizedTallness * 0.3) + (normalizedAspect * 0.2), 0, 1) * 100)

  return {
    printabilityScore,
    supportLikelihood: Number(clamp(supportLikelihood).toFixed(3)),
    failureRiskScore,
    orientationSuggestion: orientationSuggestion(dims),
  }
}
