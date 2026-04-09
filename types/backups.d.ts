declare module '@/lib/backups' {
  export function listBackups(): Array<{ folder: string; createdAt: string }>
  export function getPendingRestore(): { relativePath?: string; backupPath?: string; createdAt: string; manifest?: string } | null
}
