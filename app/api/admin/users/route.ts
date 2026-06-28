import { NextRequest, NextResponse } from 'next/server'
import { adminRouteGuards } from '@/app/api/admin/_utils'
import { fetchAdminUsersContract } from '@/lib/admin/queries'

export async function GET(req: NextRequest) {
  try {
    await adminRouteGuards.requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const q = req.nextUrl.searchParams.get('q')
    return NextResponse.json(await fetchAdminUsersContract({ q }))
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load users' }, { status: 400 })
  }
}
