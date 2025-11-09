import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ModelEditForm from '@/components/ModelEditForm'

export default async function EditModelPage({ params }: { params: { id: string } }) {
  const token = cookies().get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const [model, me] = await Promise.all([
    prisma.model.findUnique({ where: { id: params.id } }),
    prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true } })
  ])
  if (!model) redirect('/models/' + params.id)
  if (model.userId !== payload.sub && !me?.isAdmin) redirect('/models/' + params.id)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Edit Model</h1>
      <ModelEditForm model={{ id: model.id, title: model.title, description: model.description, material: model.material, coverImagePath: model.coverImagePath }} />
    </div>
  )
}

