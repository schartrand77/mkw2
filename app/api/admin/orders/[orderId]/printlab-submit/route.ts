import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { submitOrderToPrintLab } from '@/lib/printlab-order-submit'

type RouteParams = { params: Promise<{ orderId: string }> }

export async function POST(_req: Request, { params }: RouteParams) {
  let adminId: string
  try {
    adminId = await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const { orderId } = await params
    const result = await submitOrderToPrintLab(orderId, { actor: 'makerworks_admin', adminId, throwOnFailure: true })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to submit order to PrintLab.' }, { status: e.status || 400 })
  }
}
