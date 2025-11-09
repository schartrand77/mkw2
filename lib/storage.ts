import { mkdir, writeFile, stat, access } from 'fs/promises'
import { constants } from 'fs'
import path from 'path'

export function storageRoot() {
  return process.env.STORAGE_DIR || path.join(process.cwd(), 'storage')
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

