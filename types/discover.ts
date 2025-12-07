export enum DiscoverViewMode {
  Grid = 'grid',
  Compact = 'compact',
}

export enum DiscoverSort {
  Latest = 'latest',
  Popular = 'popular',
  PriceAsc = 'price_asc',
  PriceDesc = 'price_desc',
}

export type DiscoverModel = {
  id: string
  title: string
  coverImagePath?: string | null
  updatedAt?: string | null
  fileType?: string | null
  partsCount?: number | null
  priceUsd?: number | null
  basePriceUsd?: number | null
  saleActive?: boolean | null
  salePriceIsFrom?: boolean | null
  salePriceUnit?: string | null
  sizeXmm?: number | null
  sizeYmm?: number | null
  sizeZmm?: number | null
  likes?: number | null
  downloads?: number | null
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
  coverImagePath: string | null
  sizeXmm: number | null
  sizeYmm: number | null
  sizeZmm: number | null
  fileType: string | null
  priceUsd: number | null
  salePriceUsd: number | null
  salePriceIsFrom: boolean
  salePriceUnit: string | null
  volumeMm3: number | null
  material: string
  likes: number
  downloads: number
  createdAt: Date
  updatedAt: Date
  _count: {
    parts: number
  }
  modelTags: {
    tag: {
      id: string
      name: string
      slug: string
    }
  }[]
}
