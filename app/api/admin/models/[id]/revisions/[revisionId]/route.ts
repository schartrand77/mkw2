import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '../../../../_utils'

export const dynamic = 'force-dynamic'

type RevisionContext = { params: Promise<{ id: string; revisionId: string }> }

export async function PATCH(req: NextRequest, { params }: RevisionContext) {
  const { id, revisionId } = await params
  try { await requireAdmin() } catch (e: any) { return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 }) }
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const updates: any = {}
  if (body.note !== undefined) {
    const raw = String(body.note ?? '').trim()
    updates.note = raw ? raw.slice(0, 2000) : null
  }
  if (body.label !== undefined) {
    const raw = String(body.label ?? '').trim()
    updates.label = raw ? raw.slice(0, 200) : null
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }
  const updated = await prisma.modelRevision.update({
    where: { id: revisionId, modelId: id },
    data: updates,
  })
  return NextResponse.json({ revision: updated })
}
