import type { CheckoutLineItem } from '@/types/checkout'

export type ManufacturabilityModelInput = {
  id: string
  title: string
  material?: string | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  printabilityScore?: number | null
  failureRiskScore?: number | null
  orientationSuggestion?: string | null
  supportLikelihood?: number | null
}

export type ManufacturabilityItemSnapshot = {
  modelId: string
  title: string
  partName?: string
  quantity: number
  material: string
  dimensionsMm: { x?: number; y?: number; z?: number } | null
  riskLabel: 'low' | 'medium' | 'high'
  riskScore: number | null
  orientationRecommendation: string
  materialRationale: string
  notes: string[]
}

export type ManufacturabilityReportSnapshot = {
  version: number
  generatedAt: string
  summary: {
    totalItems: number
    avgRiskScore: number | null
    highestRisk: 'low' | 'medium' | 'high'
  }
  items: ManufacturabilityItemSnapshot[]
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function resolveDimensions(lineItem: CheckoutLineItem, model?: ManufacturabilityModelInput | null) {
  if (lineItem.targetDimensions && typeof lineItem.targetDimensions === 'object') {
    const x = typeof lineItem.targetDimensions.x === 'number' && Number.isFinite(lineItem.targetDimensions.x)
      ? round1(lineItem.targetDimensions.x)
      : undefined
    const y = typeof lineItem.targetDimensions.y === 'number' && Number.isFinite(lineItem.targetDimensions.y)
      ? round1(lineItem.targetDimensions.y)
      : undefined
    const z = typeof lineItem.targetDimensions.z === 'number' && Number.isFinite(lineItem.targetDimensions.z)
      ? round1(lineItem.targetDimensions.z)
      : undefined
    if (x || y || z) return { x, y, z }
  }
  if (!model) return null
  const sx = typeof lineItem.scaleX === 'number' && Number.isFinite(lineItem.scaleX) ? lineItem.scaleX : lineItem.scale
  const sy = typeof lineItem.scaleY === 'number' && Number.isFinite(lineItem.scaleY) ? lineItem.scaleY : lineItem.scale
  const sz = typeof lineItem.scaleZ === 'number' && Number.isFinite(lineItem.scaleZ) ? lineItem.scaleZ : lineItem.scale
  const x = typeof model.sizeXmm === 'number' && Number.isFinite(model.sizeXmm) ? round1(model.sizeXmm * sx) : undefined
  const y = typeof model.sizeYmm === 'number' && Number.isFinite(model.sizeYmm) ? round1(model.sizeYmm * sy) : undefined
  const z = typeof model.sizeZmm === 'number' && Number.isFinite(model.sizeZmm) ? round1(model.sizeZmm * sz) : undefined
  return x || y || z ? { x, y, z } : null
}

function riskLabelFromScore(score: number | null): 'low' | 'medium' | 'high' {
  if (score == null) return 'medium'
  if (score >= 0.65) return 'high'
  if (score >= 0.35) return 'medium'
  return 'low'
}

function materialRationale(material: string, risk: 'low' | 'medium' | 'high') {
  const key = (material || 'PLA').trim().toUpperCase()
  if (key === 'PLA') return risk === 'high'
    ? 'PLA keeps cost low for validation, but geometry risk suggests slower profile and tighter QA.'
    : 'PLA selected for reliable, cost-effective prints with quick turnaround.'
  if (key === 'PETG') return 'PETG selected for better impact/heat resistance and durable functional use.'
  if (key === 'ABS' || key === 'ASA') return `${key} selected for stronger thermal performance and outdoor-friendly durability.`
  if (key === 'TPU') return 'TPU selected to preserve flexibility and reduce brittle failure under load.'
  if (key === 'PA6' || key === 'PA12' || key === 'NYLON') return `${key} selected for wear resistance and mechanical durability.`
  if (key === 'PC') return 'PC selected for high strength and heat tolerance where load-bearing reliability matters.'
  if (key === 'RESIN') return 'Resin selected for detail precision and surface quality requirements.'
  return `${key} selected as the best match for geometry and performance constraints.`
}

function orientationRecommendation(model?: ManufacturabilityModelInput | null, dimensions?: { x?: number; y?: number; z?: number } | null) {
  if (model?.orientationSuggestion && model.orientationSuggestion.trim().length > 0) {
    return model.orientationSuggestion.trim()
  }
  if (!dimensions) return 'Orient on the largest stable face to minimize supports and improve repeatability.'
  const x = dimensions.x ?? 0
  const y = dimensions.y ?? 0
  const z = dimensions.z ?? 0
  const max = Math.max(x, y, z)
  if (max === z) return 'Orient vertically only if required by feature accuracy; prefer laying on broad face to reduce wobble.'
  return 'Orient flat on the broadest face to reduce support volume and improve first-layer stability.'
}

export function buildManufacturabilitySnapshot(args: {
  generatedAt?: Date
  lineItems: CheckoutLineItem[]
  modelsById?: Map<string, ManufacturabilityModelInput>
}) {
  const generatedAt = args.generatedAt ?? new Date()
  const items: ManufacturabilityItemSnapshot[] = args.lineItems.map((lineItem) => {
    const model = args.modelsById?.get(lineItem.modelId)
    const riskScore = typeof model?.failureRiskScore === 'number' && Number.isFinite(model.failureRiskScore)
      ? Math.max(0, Math.min(1, model.failureRiskScore))
      : null
    const riskLabel = riskLabelFromScore(riskScore)
    const dims = resolveDimensions(lineItem, model)
    const notes: string[] = []
    if (typeof model?.printabilityScore === 'number' && Number.isFinite(model.printabilityScore) && model.printabilityScore < 0.5) {
      notes.push('Printability score suggests additional setup checks before production.')
    }
    if (typeof model?.supportLikelihood === 'number' && Number.isFinite(model.supportLikelihood) && model.supportLikelihood > 0.5) {
      notes.push('Support structures likely required for overhang-heavy geometry.')
    }
    if (lineItem.finish && lineItem.finish.toLowerCase() !== 'standard') {
      notes.push(`Requested finish (${lineItem.finish}) may extend post-processing time.`)
    }
    return {
      modelId: lineItem.modelId,
      title: lineItem.title,
      partName: lineItem.partName || undefined,
      quantity: lineItem.qty,
      material: lineItem.material || model?.material || 'PLA',
      dimensionsMm: dims,
      riskLabel,
      riskScore,
      orientationRecommendation: orientationRecommendation(model, dims),
      materialRationale: materialRationale(lineItem.material || model?.material || 'PLA', riskLabel),
      notes,
    }
  })

  const riskScores = items
    .map((item) => item.riskScore)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const avgRisk = riskScores.length > 0 ? round1(riskScores.reduce((sum, value) => sum + value, 0) / riskScores.length) : null
  const highestRisk = items.some((item) => item.riskLabel === 'high')
    ? 'high'
    : items.some((item) => item.riskLabel === 'medium')
      ? 'medium'
      : 'low'

  const snapshot: ManufacturabilityReportSnapshot = {
    version: 1,
    generatedAt: generatedAt.toISOString(),
    summary: {
      totalItems: items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0),
      avgRiskScore: avgRisk,
      highestRisk,
    },
    items,
  }

  return snapshot
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function pushPdfObject(objects: string[], body: string) {
  objects.push(body)
  return objects.length
}

export function renderManufacturabilityReportPdf(snapshot: ManufacturabilityReportSnapshot, title: string) {
  const lines: string[] = []
  lines.push('Manufacturability Report')
  lines.push(title)
  lines.push(`Generated: ${new Date(snapshot.generatedAt).toLocaleString('en-US')}`)
  lines.push(`Items: ${snapshot.summary.totalItems}`)
  lines.push(`Average risk score: ${snapshot.summary.avgRiskScore != null ? snapshot.summary.avgRiskScore.toFixed(1) : 'n/a'}`)
  lines.push(`Highest risk tier: ${snapshot.summary.highestRisk}`)
  lines.push('')

  for (const [idx, item] of snapshot.items.entries()) {
    lines.push(`${idx + 1}. ${item.title}${item.partName ? ` (${item.partName})` : ''}`)
    lines.push(`   Qty ${item.quantity} | Material ${item.material} | Risk ${item.riskLabel}${item.riskScore != null ? ` (${item.riskScore.toFixed(2)})` : ''}`)
    if (item.dimensionsMm) {
      const dims = ['x', 'y', 'z']
        .map((axis) => {
          const value = item.dimensionsMm?.[axis as 'x' | 'y' | 'z']
          return typeof value === 'number' ? `${axis.toUpperCase()} ${value.toFixed(1)}mm` : null
        })
        .filter((value): value is string => Boolean(value))
        .join(' / ')
      if (dims) lines.push(`   Dimensions: ${dims}`)
    }
    lines.push(`   Orientation: ${item.orientationRecommendation}`)
    lines.push(`   Material rationale: ${item.materialRationale}`)
    for (const note of item.notes.slice(0, 2)) {
      lines.push(`   Note: ${note}`)
    }
    lines.push('')
  }

  const maxLines = 46
  if (lines.length > maxLines) {
    lines.splice(maxLines - 1)
    lines.push('... additional items omitted in MVP PDF preview')
  }

  const content = [
    'BT',
    '/F1 11 Tf',
    '14 TL',
    '40 800 Td',
    ...lines.map((line, index) => `${index === 0 ? '' : 'T* ' }(${escapePdfText(line)}) Tj`).map((line) => line.trim()),
    'ET',
  ].join('\n')

  const objects: string[] = []
  const catalogId = pushPdfObject(objects, '<< /Type /Catalog /Pages 2 0 R >>')
  const pagesId = pushPdfObject(objects, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  const pageId = pushPdfObject(objects, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>')
  const contentId = pushPdfObject(objects, `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`)
  const fontId = pushPdfObject(objects, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  void catalogId
  void pagesId
  void pageId
  void contentId
  void fontId

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'utf8')
}
