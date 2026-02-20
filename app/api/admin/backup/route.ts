import { NextResponse } from 'next/server'
import path from 'path'
import { requireAdmin } from '../_utils'
import { storageRoot, toPublicHref } from '@/lib/storage'
const { runBackup, getBackupReadiness, getRestoreReadiness, getBackupPolicy, getNextScheduledBackupAt } = require('@/lib/backups')

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const policy = getBackupPolicy()
  return NextResponse.json({
    ok: true,
    backup: getBackupReadiness(),
    restore: getRestoreReadiness(),
    policy,
    nextRunAt: policy.scheduleEnabled ? getNextScheduledBackupAt(new Date(), policy).toISOString() : null,
  })
}

export async function POST() {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
    const readiness = getBackupReadiness()
    if (!readiness.ok) {
      return NextResponse.json(
        {
          error: 'Backup prerequisites not met',
          details: readiness,
          hint:
            'Install PostgreSQL client tools and set PG_DUMP_BIN, or run with Docker Compose where the db container provides pg_dump.',
        },
        { status: 400 },
      )
    }

    const storageDir = storageRoot()
    const backupsDir = path.join(storageDir, 'backups')
    const absolutePath = runBackup({ backupDir: backupsDir })
    const rel = absolutePath.startsWith(storageDir)
      ? absolutePath.slice(storageDir.length).replace(/^[\\/]+/, '')
      : absolutePath
    const href = toPublicHref(rel)
    return NextResponse.json({ ok: true, path: href, folder: rel })
  } catch (err: any) {
    console.error('Backup failed', err)
    return NextResponse.json({ error: err?.message || 'Backup failed' }, { status: 500 })
  }
}
