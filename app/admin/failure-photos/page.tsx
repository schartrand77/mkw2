export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FailurePhotoClassifierPanel from '@/components/admin/FailurePhotoClassifierPanel'

export default async function FailurePhotosPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('mwv2_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { isAdmin: true, role: true } })
  const role = user?.role || null
  if (!(user?.isAdmin || role === 'admin' || role === 'staff')) redirect('/')

  const photos = await prisma.failurePhoto.findMany({
    take: 25,
    orderBy: { createdAt: 'desc' },
    include: {
      order: { select: { id: true, orderNumber: true } },
      printer: { select: { id: true, name: true } },
      model: { select: { id: true, title: true } },
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  })

  const initial = photos.map((p) => ({
    id: p.id,
    filePath: p.filePath,
    label: p.label,
    confidence: p.confidence,
    createdAt: p.createdAt.toISOString(),
    note: p.note,
    orderId: p.orderId,
    printerId: p.printerId,
    modelId: p.modelId,
    orderNumber: p.order?.orderNumber ?? null,
    printerName: p.printer?.name ?? null,
    modelTitle: p.model?.title ?? null,
    signals: p.signals,
    uploadedBy: p.uploadedBy,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Failure Photo Classifier</h1>
          <p className="text-sm text-slate-400 mt-1">Capture failure evidence and tag the likely root cause.</p>
        </div>
        <Link href="/admin" className="text-xs text-brand-300 underline">Back to admin</Link>
      </div>

      <FailurePhotoClassifierPanel initial={initial} />
    </div>
  )
}
