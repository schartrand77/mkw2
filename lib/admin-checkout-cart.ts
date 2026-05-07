import type { CartItem, CartOptions } from '@/components/cart/CartProvider'
import { normalizeColors, normalizeMaterialName } from '@/lib/cartPricing'
import { buildImageSrc } from '@/lib/public-path'

export type AdminCheckoutModel = {
  id: string
  title: string
  coverImagePath?: string | null
  updatedAt?: string | Date | null
  visibility?: string | null
  priceUsd?: number | null
  salePriceUsd?: number | null
  material?: string | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  flatRatePricing?: boolean | null
  colorSlotCount?: number | null
  allowedColors?: string[] | null
  defaultColors?: string[] | null
}

export type AdminCheckoutCartItem = Omit<CartItem, 'cartItemId' | 'options'> & {
  options: Partial<CartOptions>
}

function finitePositive(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined
}

export function buildAdminCheckoutCartItem(model: AdminCheckoutModel): AdminCheckoutCartItem {
  const salePrice = finitePositive(model.salePriceUsd)
  const price = salePrice ?? finitePositive(model.priceUsd) ?? null
  const colorLimit = typeof model.colorSlotCount === 'number' && Number.isFinite(model.colorSlotCount)
    ? Math.max(1, Math.min(16, Math.round(model.colorSlotCount)))
    : undefined
  const size = {
    ...(finitePositive(model.sizeXmm) ? { x: finitePositive(model.sizeXmm) } : {}),
    ...(finitePositive(model.sizeYmm) ? { y: finitePositive(model.sizeYmm) } : {}),
    ...(finitePositive(model.sizeZmm) ? { z: finitePositive(model.sizeZmm) } : {}),
  }

  return {
    modelId: model.id,
    title: model.title,
    priceUsd: price,
    thumbnail: buildImageSrc(model.coverImagePath ?? null, model.updatedAt ?? null),
    size,
    flatRatePricing: Boolean(model.flatRatePricing),
    colorSlotCount: colorLimit ?? null,
    allowedColors: Array.isArray(model.allowedColors) ? model.allowedColors : null,
    options: {
      qty: 1,
      material: normalizeMaterialName(model.material || 'PLA'),
      colors: normalizeColors(Array.isArray(model.defaultColors) ? model.defaultColors : [], colorLimit),
      finish: 'standard',
      toleranceClass: 'standard',
    },
  }
}
