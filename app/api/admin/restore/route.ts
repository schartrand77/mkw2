import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_utils'
import { storageRoot, toPublicHref } from '@/lib/storage'

const restoreModule = require('@/lib/backups')

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const storageDir = storageRoot()
  const backups = (restoreModule.listBackups() || []).map((entry: any) => ({
    folder: entry.folder,
    createdAt: entry.createdAt,
    hasStorage: entry.hasStorage,
    hasDatabase: entry.hasDatabase,
    relativePath: entry.relativePath,
    downloadUrl: entry.relativePath ? toPublicHref(entry.relativePath) : null,
  }))
  const pending = restoreModule.getPendingRestore()
  return NextResponse.json({
    backups,
    pending: pending
      ? { folder: pending.relativePath, scheduledAt: pending.createdAt }
      : null,
  })
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const folder = String(body?.folder || '').trim()
  const confirmed = Boolean(body?.confirm)
  if (!folder) return NextResponse.json({ error: 'folder required' }, { status: 400 })
  if (!confirmed) return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })

  try {
    const payload = restoreModule.scheduleRestore(folder)
    return NextResponse.json({
      ok: true,
      pending: { folder: payload.backupPath, scheduledAt: payload.createdAt },
      message: 'Restore scheduled. Restart the app to apply it.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to schedule restore' }, { status: 400 })
  }
}
