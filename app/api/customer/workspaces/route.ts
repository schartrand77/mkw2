import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromCookie } from '@/lib/auth'
import { listProjectWorkspacesForUser } from '@/lib/project-workspaces'

export async function GET(_req: NextRequest) {
  const userId = await getUserIdFromCookie()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaces = await listProjectWorkspacesForUser(userId)
  return NextResponse.json({ workspaces })
}
