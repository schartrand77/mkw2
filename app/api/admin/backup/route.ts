import { NextResponse } from 'next/server'
import { requireAdmin } from '../_utils'
import { storageRoot, toPublicHref } from '@/lib/storage'
const {
  runBackup,
  resolveBackupsDir,
  getBackupReadiness,
  getRestoreReadiness,
  getBackupPolicy,
  getNextScheduledBackupAt,
} = require('@/lib/backups')

export const dynamic = 'force-dynamic'

function isWithin(base: string, target: string) {
  const baseNorm = `${base}`.replace(/[\\/]+$/, '')
  const targetNorm = `${target}`.replace(/[\\/]+$/, '')
  return targetNorm === baseNorm || targetNorm.startsWith(`${baseNorm}/`) || targetNorm.startsWith(`${baseNorm}\\`)
}

export async function GET() {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  const storageDir = storageRoot()
  const backupsRoot = resolveBackupsDir(storageDir)
  const policy = getBackupPolicy()
  return NextResponse.json({
    ok: true,
    backup: getBackupReadiness(),
    restore: getRestoreReadiness(),
    backupsRoot,
    backupsRootInStorage: isWithin(storageDir, backupsRoot),
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
    const absolutePath = runBackup()
    const rel = isWithin(storageDir, absolutePath)
      ? absolutePath.slice(storageDir.length).replace(/^[\\/]+/, '')
      : null
    const href = rel ? toPublicHref(rel) : null
    return NextResponse.json({
      ok: true,
      path: href,
      folder: rel || absolutePath.split(/[\\/]/).pop() || absolutePath,
      absolutePath,
    })
  } catch (err: any) {
    console.error('Backup failed', err)
    return NextResponse.json({ error: err?.message || 'Backup failed' }, { status: 500 })
  }
}
