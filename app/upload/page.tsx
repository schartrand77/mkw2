import UploadForm from './UploadForm'
import { prisma } from '@/lib/db'
import { headers } from 'next/headers'
import { isLanRequestHost, readUploadByteEnv, resolveUploadUrlForRequestHost } from '@/lib/upload-config'
import { getUserIdFromCookie } from '@/lib/auth'
import { canChooseUploadVisibility } from '@/lib/upload-visibility'

export const dynamic = 'force-dynamic'

export default async function UploadPage() {
  const reqHeaders = await headers()
  const userId = await getUserIdFromCookie()
  const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' }, select: { directUploadUrl: true } })
  const viewer = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, role: true } })
    : null
  const fallback = process.env.DIRECT_UPLOAD_URL || null
  const requestHost = reqHeaders.get('x-forwarded-host') || reqHeaders.get('host')
  const isLan = isLanRequestHost(requestHost, process.env.LAN_SITE_HOSTS || null)
  const directUploadUrl = resolveUploadUrlForRequestHost({
    requestHost,
    directUploadUrl: cfg?.directUploadUrl || fallback,
    lanDirectUploadUrl: process.env.LAN_DIRECT_UPLOAD_URL || null,
    lanSiteHosts: process.env.LAN_SITE_HOSTS || null,
  })
  const maxFileBytes = isLan
    ? readUploadByteEnv('LAN_UPLOAD_MAX_FILE_BYTES', 100 * 1024 * 1024)
    : readUploadByteEnv('UPLOAD_MAX_FILE_BYTES', 100 * 1024 * 1024)
  const maxTotalBytes = isLan
    ? readUploadByteEnv('LAN_UPLOAD_MAX_TOTAL_BYTES', 200 * 1024 * 1024)
    : readUploadByteEnv('UPLOAD_MAX_TOTAL_BYTES', 200 * 1024 * 1024)
  return (
    <UploadForm
      directUploadUrl={directUploadUrl}
      maxFileBytes={maxFileBytes}
      maxTotalBytes={maxTotalBytes}
      canChooseVisibility={canChooseUploadVisibility(viewer)}
    />
  )
}
