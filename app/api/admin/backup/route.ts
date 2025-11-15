import { NextResponse } from 'next/server'
import path from 'path'
import { requireAdmin } from '../_utils'
import { storageRoot, toPublicHref } from '@/lib/storage'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runBackup } = require(path.join(process.cwd(), 'scripts', 'backup.js'))

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await requireAdmin()
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: e.status || 401 })
  }

  try {
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
