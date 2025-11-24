import UploadForm from './UploadForm'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function UploadPage() {
  const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' }, select: { directUploadUrl: true } })
  const fallback = process.env.DIRECT_UPLOAD_URL || null
  const directUploadUrl = cfg?.directUploadUrl || fallback
  return <UploadForm directUploadUrl={directUploadUrl} />
}
