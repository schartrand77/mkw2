"use strict"

const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const projectRoot = path.resolve(__dirname, "..")

function log(msg) {
  process.stdout.write(`[backup] ${msg}\n`)
}

function fail(msg) {
  const err = typeof msg === "string" ? new Error(msg) : msg
  throw err
}

function parseDatabaseUrl(urlString) {
  const url = new URL(urlString)
  const dbName = (url.pathname || "").replace(/^\//, "").split("?")[0]
  if (!dbName) throw new Error("DATABASE_URL missing database name")
  return {
    host: url.hostname || "localhost",
    port: url.port || "5432",
    user: decodeURIComponent(url.username || "postgres"),
    password: decodeURIComponent(url.password || ""),
    database: dbName,
  }
}

function tryDockerDump(destFile) {
  if (process.env.SKIP_DOCKER === "1") return false
  log("Attempting pg_dump via docker compose…")
  const result = spawnSync(
    "docker",
    ["compose", "exec", "-T", "db", "pg_dump", "-U", "postgres", "makerworks"],
    {
      cwd: projectRoot,
      encoding: "buffer",
    },
  )
  if (result.status !== 0) {
    log("Docker pg_dump failed; falling back to local pg_dump if available.")
    return false
  }
  fs.writeFileSync(destFile, result.stdout)
  return true
}

function localPgDump(destFile) {
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/makerworks?schema=public"
  const info = parseDatabaseUrl(dbUrl)
  log(`Running pg_dump against ${info.host}:${info.port}/${info.database}`)
  const env = { ...process.env, PGPASSWORD: info.password }
  const args = ["-h", info.host, "-p", info.port, "-U", info.user, info.database]
  const result = spawnSync("pg_dump", args, { env, encoding: "buffer" })
  if (result.status !== 0) {
    fail(result.stderr?.toString() || "pg_dump failed. Ensure pg_dump is installed or run with Docker Compose.")
  }
  fs.writeFileSync(destFile, result.stdout)
}

function copyStorage(storageDir, destRoot) {
  if (!fs.existsSync(storageDir)) {
    log("No storage directory found; skipping file backup.")
    return null
  }
  const dest = path.join(destRoot, "storage")
  const backupsDir = path.join(storageDir, "backups")
  log("Copying storage directory…")
  fs.cpSync(storageDir, dest, {
    recursive: true,
    filter: (src) => !src.startsWith(backupsDir),
  })
  log("Storage copied.")
  return dest
}

function resolveStorageDir() {
  if (process.env.STORAGE_DIR) return path.resolve(process.env.STORAGE_DIR)
  return path.join(projectRoot, "storage")
}

function resolveBackupRoot(storageDir, explicitDir) {
  if (explicitDir) return path.resolve(explicitDir)
  if (process.env.BACKUP_DIR) return path.resolve(process.env.BACKUP_DIR)
  return path.join(storageDir, "backups")
}

function runBackup(options = {}) {
  const storageDir = resolveStorageDir()
  const backupsRoot = resolveBackupRoot(storageDir, options.backupDir)
  if (!fs.existsSync(backupsRoot)) fs.mkdirSync(backupsRoot, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const targetDir = path.join(backupsRoot, timestamp)
  fs.mkdirSync(targetDir, { recursive: true })

  const destFile = path.join(targetDir, "db.sql")
  if (!tryDockerDump(destFile)) {
    localPgDump(destFile)
  }
  log(`Database dump saved to ${destFile}`)

  copyStorage(storageDir, targetDir)
  log(`Backup complete: ${targetDir}`)
  return targetDir
}

if (require.main === module) {
  try {
    const dir = runBackup()
    log(`Backup stored at ${dir}`)
  } catch (err) {
    console.error(`[backup] ${err.message || err}`)
    process.exit(1)
  }
}

module.exports = { runBackup }
