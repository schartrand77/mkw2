import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ModelImagesManager from '@/components/admin/ModelImagesManager'

export default async function AdminModelImagesPage({ params }: { params: { id: string } }) {
  const token = cookies().get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } })
  if (!user?.isAdmin) redirect('/')

  const model = await prisma.model.findUnique({ where: { id: params.id }, select: { id: true, title: true, coverImagePath: true } })
  if (!model) redirect('/admin')

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-slate-400 hover:text-white">← Back to Admin</Link>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Model</p>
        <h1 className="text-2xl font-semibold">{model.title}</h1>
      </div>
      <ModelImagesManager modelId={model.id} initialCover={model.coverImagePath} />
    </div>
  )
}
