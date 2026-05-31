import { redirect } from 'next/navigation'

type AdminModelImagesPageProps = { params: Promise<{ id: string }> }

export default async function AdminModelImagesPage({ params }: AdminModelImagesPageProps) {
  const { id } = await params
  redirect(`/admin/models?modelId=${id}`)
}
