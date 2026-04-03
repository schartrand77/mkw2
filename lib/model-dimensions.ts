import { resolveScaleFromDimensions, type ModelDimensions, type TargetDimensions } from '@/lib/cartPricing'

const DIMENSION_AXES = ['x', 'y', 'z'] as const

export type StlStats = {
  volumeMm3: number | null
  sizeXmm?: number
  sizeYmm?: number
  sizeZmm?: number
  supportAreaRatio?: number
}

type DimensionScale = {
  scaleX: number
  scaleY: number
  scaleZ: number
  volumeMultiplier: number
}

function countTargetAxes(target?: TargetDimensions | null) {
  if (!target) return 0
  return DIMENSION_AXES.reduce((count, axis) => {
    const value = target[axis]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return count + 1
    return count
  }, 0)
}

function computeDimensionScale(size?: ModelDimensions | null, target?: TargetDimensions | null): DimensionScale | null {
  if (!size || !target) return null
  const axisCount = countTargetAxes(target)
  if (axisCount === 0) return null
  const { scaleX, scaleY, scaleZ } = resolveScaleFromDimensions({
    size,
    target,
    lockDimensions: axisCount <= 1,
  })
  return {
    scaleX,
    scaleY,
    scaleZ,
    volumeMultiplier: scaleX * scaleY * scaleZ,
  }
}

export function scaleStatsToTargetDimensions(stats: StlStats, target?: TargetDimensions | null): StlStats {
  const scale = computeDimensionScale(
    {
      x: stats.sizeXmm ?? null,
      y: stats.sizeYmm ?? null,
      z: stats.sizeZmm ?? null,
    },
    target,
  )
  if (!scale) return stats
  return {
    volumeMm3: stats.volumeMm3 != null && Number.isFinite(stats.volumeMm3)
      ? stats.volumeMm3 * scale.volumeMultiplier
      : stats.volumeMm3,
    sizeXmm: stats.sizeXmm != null ? stats.sizeXmm * scale.scaleX : stats.sizeXmm,
    sizeYmm: stats.sizeYmm != null ? stats.sizeYmm * scale.scaleY : stats.sizeYmm,
    sizeZmm: stats.sizeZmm != null ? stats.sizeZmm * scale.scaleZ : stats.sizeZmm,
    supportAreaRatio: stats.supportAreaRatio,
  }
}
