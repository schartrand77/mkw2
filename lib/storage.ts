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

export { toPublicHref, buildImageSrc } from './public-path'
