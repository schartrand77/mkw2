import { prisma } from '@/lib/db'

export function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function uniqueSlug(base: string) {
  let slug = base || 'user'
  let i = 0
  // Avoid infinite loops in worst case
  while (i < 50) {
    const exists = await prisma.profile.findUnique({ where: { slug } })
    if (!exists) return slug
    i++
    slug = `${base || 'user'}-${i}`
  }
  // Fallback with random suffix
  return `${base || 'user'}-${Math.random().toString(36).slice(2, 7)}`
}

export async function ensureUserPage(userId: string, email?: string | null, name?: string | null) {
  const existing = await prisma.profile.findFirst({ where: { userId } })
  if (existing) return existing
  const base = slugify(name || (email ? email.split('@')[0] : 'user'))
  const slug = await uniqueSlug(base)
  return prisma.profile.create({ data: { userId, slug } })
}
