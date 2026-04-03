import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_utils'
import { getRetentionPolicy, runDataRetentionCleanup } from '@/lib/data-retention'
import { getAdminAuditRequestMeta, recordAdminAuditEvent } from '@/lib/admin-audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  return NextResponse.json({ policy: getRetentionPolicy() })
}

export async function POST(req: NextRequest) {
  let adminId = ''
  try {
    adminId = await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }
  const body = await req.json().catch(() => ({}))
  const dryRun = Boolean((body as any)?.dryRun)
  const summary = await runDataRetentionCleanup({ dryRun })
  try {
    const requestMeta = getAdminAuditRequestMeta(req)
    await recordAdminAuditEvent({
      adminId,
      action: 'admin.data_retention.run',
      targetType: 'system',
      requestMethod: requestMeta.requestMethod,
      requestPath: requestMeta.requestPath,
      requestIp: requestMeta.requestIp,
      userAgent: requestMeta.userAgent,
      metadata: summary as any,
    })
  } catch {
    // do not fail cleanup on audit persistence failure
  }
  return NextResponse.json({ summary })
}
