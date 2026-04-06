export enum DiscoverViewMode {
  Grid = 'grid',
  Compact = 'compact',
}

export enum DiscoverSort {
  Latest = 'latest',
  Popular = 'popular',
  PriceAsc = 'price_asc',
  PriceDesc = 'price_desc',
  BestConfidence = 'best_confidence',
  FastestToShip = 'fastest_to_ship',
  LowestFailureRisk = 'lowest_failure_risk',
}

export enum DiscoverEntityType {
  Model = 'model',
  Product = 'product',
  Merch = 'merch',
}

export type DiscoverModel = {
  id: string
  entityType?: DiscoverEntityType | null
  href?: string | null
  title: string
  description?: string | null
  material?: string | null
  coverImagePath?: string | null
  fileType?: string | null
  partsCount?: number | null
  priceUsd?: number | null
  basePriceUsd?: number | null
  salePriceUsd?: number | null
  saleActive?: boolean | null
  salePriceIsFrom?: boolean | null
  salePriceUnit?: string | null
  flatRatePricing?: boolean | null
  colorSlotCount?: number | null
  allowedColors?: string[] | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  likes?: number | null
  downloads?: number | null
  commentsCount?: number | null
  printabilityScore?: number | null
  failureRiskScore?: number | null
  supportLikelihood?: number | null
  materialAvailability?: 'in_stock' | 'limited' | 'out_of_stock' | 'unknown' | null
  materialLeadTimeDays?: number | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  defaultColors?: string[] | null
  recommendationScore?: number | null
  recommendationReasons?: string[] | null
  tags?: Array<{
    id: string
    name: string
    slug: string
  }> | null
}

export type CardInfo = {
  model: DiscoverModel
  coverSrc?: string | null
  priceLabel?: string | null
  sizeLabel: string
  partsLabel: string | null
}

export type ModelWithPartsCountAndTags = {
  id: string
  title: string
  description?: string | null
  coverImagePath: string | null
  sizeXmm: number | null
  sizeYmm: number | null
  sizeZmm: number | null
  fileType: string | null
  material?: string | null
  priceUsd: number | null
  effectivePriceUsd?: number | null
  salePriceUsd: number | null
  salePriceIsFrom: boolean
  salePriceUnit: string | null
  flatRatePricing?: boolean | null
  colorSlotCount?: number | null
  allowedColors?: string[] | null
  likes: number
  downloads: number
  printabilityScore?: number | null
  failureRiskScore?: number | null
  supportLikelihood?: number | null
  materialAvailability?: 'in_stock' | 'limited' | 'out_of_stock' | 'unknown' | null
  materialLeadTimeDays?: number | null
  createdAt: Date
  updatedAt: Date
  _count: {
    parts: number
    comments: number
  }
  modelTags: {
    tag: {
      id: string
      name: string
      slug: string
    }
  }[]
}
