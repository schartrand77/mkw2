import type { Prisma } from '@prisma/client'

export const DISCOVERABLE_MODEL_VISIBILITY = 'public'
export const DIRECT_ORDERABLE_MODEL_VISIBILITIES = ['public', 'unlisted'] as const

export function isDirectOrderableVisibility(visibility: string | null | undefined) {
  return DIRECT_ORDERABLE_MODEL_VISIBILITIES.includes(visibility as typeof DIRECT_ORDERABLE_MODEL_VISIBILITIES[number])
}

export function discoverVisibleModelWhere(): Prisma.ModelWhereInput {
  return { visibility: DISCOVERABLE_MODEL_VISIBILITY }
}

export function checkoutVisibleModelWhere(
  ids: string[],
  userId?: string | null,
  hasElevatedModelAccess = false,
): Prisma.ModelWhereInput {
  if (hasElevatedModelAccess) return { id: { in: ids } }
  const directOrderable = { visibility: { in: [...DIRECT_ORDERABLE_MODEL_VISIBILITIES] } }
  if (userId) {
    return {
      id: { in: ids },
      OR: [
        directOrderable,
        { userId },
      ],
    }
  }
  return {
    id: { in: ids },
    ...directOrderable,
  }
}

export function checkoutVisiblePartWhere(
  ids: string[],
  userId?: string | null,
  hasElevatedModelAccess = false,
): Prisma.ModelPartWhereInput {
  if (hasElevatedModelAccess) return { id: { in: ids } }
  const directOrderable = { visibility: { in: [...DIRECT_ORDERABLE_MODEL_VISIBILITIES] } }
  if (userId) {
    return {
      id: { in: ids },
      model: {
        OR: [
          directOrderable,
          { userId },
        ],
      },
    }
  }
  return {
    id: { in: ids },
    model: directOrderable,
  }
}
