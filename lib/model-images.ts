export const MODEL_IMAGE_LIMIT = 5

type ModelImageLike = {
  sortOrder?: bigint | number | null
}

function normalizeSortOrder(value: bigint | number | null | undefined) {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number') return value
  return value ?? 0
}

export function serializeModelImage<T extends ModelImageLike>(image: T | null | undefined) {
  if (!image) return image
  const { sourcePath, error, ...rest } = image as any
  return {
    ...rest,
    sortOrder: normalizeSortOrder(image.sortOrder),
    status: (image as any).status ?? null,
  } as T
}

export function serializeModelImages<T extends ModelImageLike>(images: T[] = []) {
  return images.map((img) => serializeModelImage(img) as T)
}
