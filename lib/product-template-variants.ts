type TemplateVariantReference = {
  id: string
  stockworksMaterialId?: number | null
  stockworksVariantMap?: unknown
}

function collectReferencedMaterialIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const output: number[] = []
  for (const row of value) {
    const materialId = Number((row as any)?.materialId)
    if (Number.isFinite(materialId) && materialId > 0) output.push(materialId)
  }
  return output
}

export function filterLinkedVariantTemplates<T extends TemplateVariantReference>(templates: T[]): T[] {
  const ownerByMaterialId = new Map<number, Set<string>>()

  for (const template of templates) {
    for (const materialId of collectReferencedMaterialIds(template.stockworksVariantMap)) {
      if (!ownerByMaterialId.has(materialId)) ownerByMaterialId.set(materialId, new Set())
      ownerByMaterialId.get(materialId)!.add(template.id)
    }
  }

  return templates.filter((template) => {
    const materialId = Number(template.stockworksMaterialId)
    if (!Number.isFinite(materialId) || materialId <= 0) return true
    const owners = ownerByMaterialId.get(materialId)
    if (!owners || owners.size === 0) return true
    if (owners.size === 1 && owners.has(template.id)) return true
    return false
  })
}
