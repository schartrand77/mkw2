import { normalizeMaterialName } from '@/lib/cartPricing'

type Constraints = {
  needImpactResistance?: boolean
  needHeatResistance?: boolean
  needUvResistance?: boolean
  needFlexibility?: boolean
  budgetSensitive?: boolean
}

type Inputs = Constraints & {
  currentMaterial?: string | null
  failureRiskScore?: number | null
  printabilityScore?: number | null
}

export type MaterialRecommendation = {
  material: string
  score: number
  reasons: string[]
}

const MATERIAL_PROFILES: Array<{
  material: string
  impact: number
  heat: number
  uv: number
  flexibility: number
  budget: number
  ease: number
}> = [
  { material: 'PLA', impact: 35, heat: 20, uv: 35, flexibility: 10, budget: 95, ease: 92 },
  { material: 'PETG', impact: 70, heat: 60, uv: 55, flexibility: 25, budget: 75, ease: 78 },
  { material: 'ABS', impact: 72, heat: 72, uv: 45, flexibility: 20, budget: 68, ease: 48 },
  { material: 'ASA', impact: 72, heat: 74, uv: 88, flexibility: 18, budget: 62, ease: 50 },
  { material: 'TPU', impact: 78, heat: 45, uv: 55, flexibility: 96, budget: 58, ease: 45 },
  { material: 'PA12', impact: 82, heat: 76, uv: 50, flexibility: 45, budget: 42, ease: 40 },
  { material: 'PC', impact: 88, heat: 92, uv: 55, flexibility: 18, budget: 34, ease: 28 },
]

export function recommendMaterials(input: Inputs): MaterialRecommendation[] {
  const currentMaterial = normalizeMaterialName(input.currentMaterial)
  const reliabilityBias = typeof input.failureRiskScore === 'number' ? Math.max(0, 100 - input.failureRiskScore) : 60
  const printabilityBias = typeof input.printabilityScore === 'number' ? input.printabilityScore : 60

  return MATERIAL_PROFILES.map((profile) => {
    let score = profile.ease * 0.25 + profile.budget * 0.1
    const reasons: string[] = []
    if (input.needImpactResistance) {
      score += profile.impact * 0.2
      if (profile.impact >= 70) reasons.push('Better impact durability')
    }
    if (input.needHeatResistance) {
      score += profile.heat * 0.2
      if (profile.heat >= 70) reasons.push('Handles higher temperatures')
    }
    if (input.needUvResistance) {
      score += profile.uv * 0.15
      if (profile.uv >= 75) reasons.push('Better UV / outdoor stability')
    }
    if (input.needFlexibility) {
      score += profile.flexibility * 0.2
      if (profile.flexibility >= 70) reasons.push('Preserves flexibility')
    }
    if (input.budgetSensitive) {
      score += profile.budget * 0.15
      if (profile.budget >= 75) reasons.push('Lower-cost option')
    }
    score += (profile.ease * reliabilityBias / 100) * 0.08
    score += (profile.ease * printabilityBias / 100) * 0.07
    if (profile.material === currentMaterial) {
      score += 6
      reasons.push('Closest to current selection')
    }
    if (reasons.length === 0) {
      reasons.push(profile.ease >= 75 ? 'Easy to print reliably' : 'Tradeoff option for performance requirements')
    }
    return {
      material: profile.material,
      score: Math.round(score),
      reasons: reasons.slice(0, 3),
    }
  }).sort((a, b) => b.score - a.score).slice(0, 3)
}
