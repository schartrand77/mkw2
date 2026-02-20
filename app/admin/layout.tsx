export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getUserIdFromCookie } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userId = await getUserIdFromCookie()
  if (!userId) redirect('/login')

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  return <>{children}</>
}
