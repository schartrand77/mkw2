type HomeCommentUser = {
  name?: string | null
  profile?: {
    slug?: string | null
  } | null
}

export function getHomeCommentDisplayName(user: HomeCommentUser | null | undefined) {
  const name = user?.name?.trim()
  if (name) {
    return name.split(/\s+/)[0]
  }

  const slug = user?.profile?.slug?.trim()
  return slug ? `@${slug}` : 'Community maker'
}

export function normalizeHomeCommentDisplayName(displayName: string | null | undefined, profileSlug?: string | null) {
  const name = displayName?.trim()
  if (name) {
    return name.startsWith('@') ? name : name.split(/\s+/)[0]
  }

  const slug = profileSlug?.trim()
  return slug ? `@${slug}` : 'Community maker'
}
