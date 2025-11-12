import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getUserIdFromCookie } from '@/lib/auth'
import { ensureUserPage } from '@/lib/userpage'

export default async function MePage() {
  const userId = await getUserIdFromCookie()
  if (!userId) redirect('/login')
  // Ensure profile exists then redirect to it
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) redirect('/login')
  const profile = await ensureUserPage(user.id, user.email, user.name)
  redirect(`/u/${profile.slug}`)
}
