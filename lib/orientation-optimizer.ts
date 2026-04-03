type OrientationInputs = {
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  supportRatio?: number | null
}

type OrientationRecommendation = {
  summary: string
  confidence: 'low' | 'medium' | 'high'
}

function normalizeDims(inputs: OrientationInputs) {
  const x = inputs.sizeXmm != null ? Number(inputs.sizeXmm) : NaN
  const y = inputs.sizeYmm != null ? Number(inputs.sizeYmm) : NaN
  const z = inputs.sizeZmm != null ? Number(inputs.sizeZmm) : NaN
  if (![x, y, z].every((val) => Number.isFinite(val) && val > 0)) return null
  return { x, y, z }
}

function resolveConfidence(inputs: OrientationInputs, dims: { x: number; y: number; z: number }) {
  const supportRatio = inputs.supportRatio != null && Number.isFinite(Number(inputs.supportRatio))
    ? Number(inputs.supportRatio)
    : null
  const aspect = Math.max(dims.x, dims.y, dims.z) / Math.min(dims.x, dims.y, dims.z)
  if (supportRatio != null && supportRatio > 0.4) return 'high'
  if (aspect > 2.5) return 'high'
  if (supportRatio != null) return 'medium'
  return 'low'
}

export function recommendOrientation(inputs: OrientationInputs): OrientationRecommendation | null {
  const dims = normalizeDims(inputs)
  if (!dims) return null

  const axes = [
    { axis: 'X', value: dims.x },
    { axis: 'Y', value: dims.y },
    { axis: 'Z', value: dims.z },
  ].sort((a, b) => a.value - b.value)
  const smallest = axes[0]
  const bedAxes = axes.slice(1).map((entry) => entry.axis).join('×')

  const supportRatio = inputs.supportRatio != null && Number.isFinite(Number(inputs.supportRatio))
    ? Number(inputs.supportRatio)
    : null
  const tallness = dims.z / Math.max(1, Math.min(dims.x, dims.y))
  const wideBase = Math.max(dims.x, dims.y) / Math.max(1, dims.z)

  let summary = `AI orientation optimizer: keep ${smallest.axis} as height to maximize ${bedAxes} bed contact.`
  if (supportRatio != null && supportRatio > 0.35) {
    summary += ' Support-heavy geometry detected; consider rotating to reduce overhangs.'
  }
  if (tallness > 2.2) {
    summary += ' Tall aspect detected; laying the longest side down improves stability.'
  } else if (wideBase > 2.5) {
    summary += ' Wide footprint allows taller print without supports.'
  }

  return {
    summary,
    confidence: resolveConfidence(inputs, dims),
  }
}
