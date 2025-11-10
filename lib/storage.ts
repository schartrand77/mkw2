import { mkdir, writeFile, stat, access } from 'fs/promises'
import { constants, existsSync } from 'fs'
import path from 'path'

export function storageRoot() {
  const envRoot = process.env.STORAGE_DIR
  if (envRoot && existsSync(envRoot)) return envRoot
  // Fallback to project storage dir when env path is unset or invalid (e.g., Docker path in local dev)
  return path.join(process.cwd(), 'storage')
}

export async function ensureDir(p: string) {
  await mkdir(p, { recursive: true })
}

export async function pathExists(p: string) {
  try {
    await access(p, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function saveBuffer(relPath: string, buf: Buffer) {
  const full = path.join(storageRoot(), relPath)
  await ensureDir(path.dirname(full))
  await writeFile(full, buf)
  return full
}

export function publicFilePath(relPath: string) {
  // Return web route base `/files` + relPath for client
  return `/files/${relPath}`.replace(/\\/g, '/').replace(/\/+/, '/')
}

// Normalize any stored path into a public href under `/files/...`.
// Handles older absolute paths (e.g. `/app/storage/<rel>` or `storage/<rel>`)
// and ensures forward slashes and a single `/files/` prefix.
export function toPublicHref(p: string | null | undefined): string | null {
  if (!p) return null
  let s = String(p).replace(/\\/g, '/')
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.startsWith('/files/')) return s
  // Strip any leading known storage roots
  const storageIdx = s.indexOf('/storage/')
  if (storageIdx !== -1) s = s.slice(storageIdx + '/storage/'.length)
  else if (s.startsWith('/app/storage/')) s = s.slice('/app/storage/'.length)
  else if (s.startsWith('storage/')) s = s.slice('storage/'.length)
  // Ensure leading slash on relative content path
  if (!s.startsWith('/')) s = '/' + s
  return '/files' + s
}
