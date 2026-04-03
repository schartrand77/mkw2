import sharp from 'sharp'

export type FailurePhotoSignals = {
  width: number
  height: number
  mean: number
  stdDev: number
  edgeDensity: number
  edgeBias: number
  borderEdgeRatio: number
  brightRatio: number
  darkRatio: number
}

export type FailurePhotoClassification = {
  label: string
  confidence: number
  signals: FailurePhotoSignals
  scores: Record<string, number>
}

const MAX_SIDE = 256

export async function classifyFailurePhoto(buffer: Buffer): Promise<FailurePhotoClassification> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width || 1
  const height = info.height || 1
  const total = width * height
  let sum = 0
  let sumSq = 0
  let bright = 0
  let dark = 0
  let edge = 0
  let edgeDx = 0
  let edgeDy = 0
  let borderEdge = 0

  const edgeThreshold = 28
  const borderX = Math.max(1, Math.round(width * 0.1))
  const borderY = Math.max(1, Math.round(height * 0.1))

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      const val = data[idx] ?? 0
      sum += val
      sumSq += val * val
      if (val > 200) bright += 1
      if (val < 50) dark += 1
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) continue
      const left = data[idx - 1] ?? 0
      const right = data[idx + 1] ?? 0
      const up = data[idx - width] ?? 0
      const down = data[idx + width] ?? 0
      const dx = Math.abs(right - left)
      const dy = Math.abs(down - up)
      const grad = dx + dy
      if (grad > edgeThreshold) {
        edge += 1
        if (dx > dy) edgeDx += 1
        else edgeDy += 1
        if (x < borderX || x > width - borderX - 1 || y < borderY || y > height - borderY - 1) {
          borderEdge += 1
        }
      }
    }
  }

  const mean = total ? sum / total : 0
  const variance = total ? Math.max(0, sumSq / total - mean * mean) : 0
  const stdDev = Math.sqrt(variance)
  const edgeDensity = total ? edge / total : 0
  const edgeBias = edge ? Math.abs(edgeDx - edgeDy) / edge : 0
  const borderEdgeRatio = edge ? borderEdge / edge : 0
  const brightRatio = total ? bright / total : 0
  const darkRatio = total ? dark / total : 0

  const signals: FailurePhotoSignals = {
    width,
    height,
    mean: round(mean, 2),
    stdDev: round(stdDev, 2),
    edgeDensity: round(edgeDensity, 4),
    edgeBias: round(edgeBias, 3),
    borderEdgeRatio: round(borderEdgeRatio, 3),
    brightRatio: round(brightRatio, 3),
    darkRatio: round(darkRatio, 3),
  }

  const scores: Record<string, number> = {
    spaghetti: 0,
    stringing: 0,
    warping: 0,
    layer_shift: 0,
    under_extrusion: 0,
    over_extrusion: 0,
    bed_adhesion: 0,
    unknown: 0.2,
  }

  if (edgeDensity > 0.18) scores.spaghetti += 0.5
  if (brightRatio > 0.25) scores.spaghetti += 0.2
  if (mean > 150) scores.spaghetti += 0.2

  if (edgeDensity > 0.12) scores.stringing += 0.35
  if (stdDev < 60) scores.stringing += 0.25
  if (brightRatio < 0.3) scores.stringing += 0.2

  if (borderEdgeRatio > 0.55) scores.warping += 0.45
  if (edgeDensity > 0.08) scores.warping += 0.2

  if (edgeBias > 0.35) scores.layer_shift += 0.4
  if (edgeDensity > 0.08) scores.layer_shift += 0.2

  if (edgeDensity < 0.06 && mean > 165) scores.under_extrusion += 0.6
  if (edgeDensity < 0.08 && brightRatio > 0.45) scores.under_extrusion += 0.2

  if (edgeDensity > 0.12 && brightRatio > 0.35) scores.over_extrusion += 0.5
  if (stdDev > 70) scores.over_extrusion += 0.2

  if (darkRatio > 0.45 && edgeDensity < 0.07) scores.bed_adhesion += 0.6
  if (borderEdgeRatio > 0.5) scores.bed_adhesion += 0.2

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [label, score] = sorted[0]
  const confidence = Math.max(0.35, Math.min(0.9, score + 0.2))

  return {
    label,
    confidence: round(confidence, 2),
    signals,
    scores,
  }
}

function round(value: number, digits: number) {
  const factor = Math.pow(10, digits)
  return Math.round(value * factor) / factor
}
