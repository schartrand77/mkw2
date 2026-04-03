import { NextResponse } from 'next/server'
import { getUserIdFromCookie } from '@/lib/auth'
import { exportUserPrivacyData } from '@/lib/privacy'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await exportUserPrivacyData(userId)
  return NextResponse.json(data)
}
