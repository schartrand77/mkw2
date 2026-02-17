type LockedTemplateInput = {
  material?: string | null
  color?: string | null
  colorCount?: number | null
  scale?: number | null
  finish?: string | null
  priceMultiplier?: number | null
}

export type ProductTemplateOptionRow = {
  label: string
  value?: string
  scale?: number
  colorCount?: number
  priceMultiplier?: number
}

export function normalizeLockedTemplateConfig(input: LockedTemplateInput) {
  const material = (input.material || 'PLA').trim() || 'PLA'
  const color = (input.color || '').trim() || null
  const colorCount = Math.max(1, Math.min(16, Math.round(Number(input.colorCount ?? 1) || 1)))
  const scale = Math.max(0.1, Math.min(5, Number(input.scale ?? 1) || 1))
  const finish = (input.finish || 'standard').trim().toLowerCase() || 'standard'
  const priceMultiplier = Math.max(0.1, Math.min(5, Number(input.priceMultiplier ?? 1) || 1))
  return { material, color, colorCount, scale, finish, priceMultiplier }
}

export function buildLockedTemplateOptions(input: LockedTemplateInput) {
  const locked = normalizeLockedTemplateConfig(input)
  const materialOptions: ProductTemplateOptionRow[] = [
    { label: locked.material, value: locked.material, priceMultiplier: 1 },
  ]
  const colorOptions: ProductTemplateOptionRow[] = [
    {
      label: locked.color || 'Standard',
      value: locked.color || undefined,
      colorCount: locked.colorCount,
      priceMultiplier: 1,
    },
  ]
  const sizeOptions: ProductTemplateOptionRow[] = [
    { label: 'Configured size', scale: locked.scale, priceMultiplier: locked.priceMultiplier },
  ]
  return { ...locked, materialOptions, colorOptions, sizeOptions }
}

