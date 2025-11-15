"use strict"

const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const projectRoot = path.resolve(__dirname, "..")
const DEFAULT_DB_URL = "postgresql://postgres:postgres@localhost:5432/makerworks?schema=public"

function resolveStorageDir() {
  if (process.env.STORAGE_DIR) return path.resolve(process.env.STORAGE_DIR)
  return path.join(projectRoot, "storage")
}

function resolveBackupsDir(storageDir = resolveStorageDir()) {
  return path.join(storageDir, "backups")
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

function parseDatabaseUrl(urlString) {
  const url = new URL(urlString || DEFAULT_DB_URL)
  const database = (url.pathname || "").replace(/^\//, "").split("?")[0]
  if (!database) throw new Error("DATABASE_URL missing database name")
  return {
    host: url.hostname || "localhost",
    port: url.port || "5432",
    user: decodeURIComponent(url.username || "postgres"),
    password: decodeURIComponent(url.password || ""),
    database,
  }
}

function getDbInfo() {
  return parseDatabaseUrl(process.env.DATABASE_URL || DEFAULT_DB_URL)
}

function runDockerPsql(args, input) {
  if (process.env.SKIP_DOCKER === "1") return false
  const info = getDbInfo()
  const env = { ...process.env }
  if (info.password) env.PGPASSWORD = info.password
  const cmd = [
    "compose",
    "exec",
    "-T",
    "db",
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    info.user || "postgres",
    info.database,
    ...args,
  ]
  const result = spawnSync("docker", cmd, {
    cwd: projectRoot,
    env,
    encoding: input ? undefined : "utf8",
    input,
  })
  return result.status === 0
}

function runLocalPsql(args, input) {
  const info = getDbInfo()
  const env = { ...process.env }
  if (info.password) env.PGPASSWORD = info.password
  const cmd = [
    "-h",
    info.host,
    "-p",
    info.port,
    "-U",
    info.user,
    "-v",
    "ON_ERROR_STOP=1",
    info.database,
    ...args,
  ]
  const result = spawnSync("psql", cmd, {
    env,
    encoding: input ? undefined : "utf8",
    input,
  })
  return result.status === 0
}

function runPsql(args = [], input) {
  if (runDockerPsql(args, input)) return true
  if (runLocalPsql(args, input)) return true
  throw new Error("Failed to run psql. Ensure docker compose or psql are available.")
}

function runSql(sql) {
  return runPsql(["-c", sql])
}

function restoreSqlFile(sqlFile) {
  const body = fs.readFileSync(sqlFile)
  return runPsql([], body)
}

function listBackups() {
  const storageDir = resolveStorageDir()
  const backupsDir = resolveBackupsDir(storageDir)
  if (!fs.existsSync(backupsDir)) return []
  const entries = fs.readdirSync(backupsDir, { withFileTypes: true }).filter((d) => d.isDirectory())
  const list = entries.map((entry) => {
    const full = path.join(backupsDir, entry.name)
    const stats = fs.statSync(full)
    const rel = path.relative(storageDir, full).replace(/\\/g, "/")
    return {
      folder: entry.name,
      createdAt: stats.mtime.toISOString(),
      absolutePath: full,
      relativePath: rel,
      hasStorage: fs.existsSync(path.join(full, "storage")),
      hasDatabase: fs.existsSync(path.join(full, "db.sql")),
    }
  })
  list.sort((a, b) => (a.folder < b.folder ? 1 : -1))
  return list
}

function getPendingRestore() {
  const storageDir = resolveStorageDir()
  const backupsDir = resolveBackupsDir(storageDir)
  const manifest = path.join(backupsDir, "pending-restore.json")
  if (!fs.existsSync(manifest)) return null
  try {
    const payload = JSON.parse(fs.readFileSync(manifest, "utf8"))
    const backupAbsolute = path.isAbsolute(payload.backupPath)
      ? payload.backupPath
      : path.join(storageDir, payload.backupPath || "")
    return {
      ...payload,
      manifest,
      backupAbsolute,
      relativePath: path.relative(storageDir, backupAbsolute).replace(/\\/g, "/"),
    }
  } catch {
    return null
  }
}

function scheduleRestore(folder) {
  const storageDir = resolveStorageDir()
  const backupsDir = resolveBackupsDir(storageDir)
  ensureDir(backupsDir)
  const normalized = folder.replace(/\\/g, "/").replace(/^backups\//, "")
  const target = path.join(backupsDir, normalized)
  if (!fs.existsSync(target)) throw new Error("Backup folder not found.")
  const manifest = path.join(backupsDir, "pending-restore.json")
  const payload = {
    backupPath: path.relative(storageDir, target).replace(/\\/g, "/"),
    createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(manifest, JSON.stringify(payload, null, 2))
  return payload
}

function cleanStorage(storageDir) {
  ensureDir(storageDir)
  const entries = fs.readdirSync(storageDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === "backups") continue
    const target = path.join(storageDir, entry.name)
    fs.rmSync(target, { recursive: true, force: true })
  }
}

function copyFromBackup(backupPath, storageDir) {
  const src = path.join(backupPath, "storage")
  if (!fs.existsSync(src)) return
  fs.cpSync(src, storageDir, { recursive: true })
}

function applyPendingRestore() {
  const pending = getPendingRestore()
  if (!pending) return null
  const storageDir = resolveStorageDir()
  const backupAbs = pending.backupAbsolute
  if (!backupAbs || !fs.existsSync(backupAbs)) {
    fs.rmSync(pending.manifest, { force: true })
    throw new Error("Pending restore backup missing.")
  }
  const sqlFile = path.join(backupAbs, "db.sql")
  if (!fs.existsSync(sqlFile)) {
    fs.rmSync(pending.manifest, { force: true })
    throw new Error("Backup missing db.sql")
  }

  runSql("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
  restoreSqlFile(sqlFile)

  cleanStorage(storageDir)
  copyFromBackup(backupAbs, storageDir)

  fs.rmSync(pending.manifest, { force: true })
  return { backupPath: pending.relativePath }
}

if (require.main === module) {
  try {
    const applied = applyPendingRestore()
    if (applied) {
      console.log(`[restore] Applied backup from ${applied.backupPath}`)
    } else {
      console.log("[restore] No pending restore.")
    }
  } catch (err) {
    console.error("[restore] Failed to apply backup:", err.message || err)
    process.exit(1)
  }
}

module.exports = {
  listBackups,
  scheduleRestore,
  getPendingRestore,
  applyPendingRestore,
  resolveStorageDir,
  resolveBackupsDir,
}
