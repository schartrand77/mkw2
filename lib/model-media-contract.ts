export const MODEL_CARD_FALLBACK_IMAGE = '/images/model-card-fallback.svg'

type ModelCardMediaInput = {
  title: string
  coverImagePath?: string | null
  coverImageStatus?: string | null
  imageAlt?: string | null
}

export type ModelCardMedia = {
  src: string
  alt: string
  fallbackSrc: string
  state: 'ready' | 'processing' | 'fallback'
}

export function validateAdminModelImageAlt(value: string | null | undefined) {
  if (typeof value === 'string' && value.trim().length > 0) return { ok: true as const }
  return { ok: false as const, error: 'Alt text is required for model card images.' }
}

export function buildModelCardMedia(input: ModelCardMediaInput): ModelCardMedia {
  const alt = input.imageAlt?.trim() || input.title.trim() || 'Model image'
  const hasReadyCover = !!input.coverImagePath && input.coverImageStatus !== 'failed'
  if (!hasReadyCover) {
    return {
      src: MODEL_CARD_FALLBACK_IMAGE,
      alt,
      fallbackSrc: MODEL_CARD_FALLBACK_IMAGE,
      state: 'fallback',
    }
  }
  return {
    src: input.coverImagePath!,
    alt,
    fallbackSrc: MODEL_CARD_FALLBACK_IMAGE,
    state: input.coverImageStatus === 'processing' ? 'processing' : 'ready',
  }
}
