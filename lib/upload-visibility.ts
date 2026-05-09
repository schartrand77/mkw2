export const UPLOAD_VISIBILITIES = ['public', 'unlisted', 'private'] as const

export type UploadVisibility = typeof UPLOAD_VISIBILITIES[number]

type UploadViewer = {
  isAdmin?: boolean | null
  role?: string | null
} | null | undefined

export function canChooseUploadVisibility(viewer: UploadViewer) {
  return Boolean(viewer?.isAdmin || viewer?.role === 'admin' || viewer?.role === 'staff')
}

export function resolveUploadVisibility(value: unknown, canChoose: boolean): UploadVisibility {
  if (!canChoose) return 'public'
  return UPLOAD_VISIBILITIES.includes(value as UploadVisibility) ? value as UploadVisibility : 'public'
}
