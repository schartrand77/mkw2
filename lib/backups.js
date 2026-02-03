"use strict"

const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const projectRoot = path.resolve(__dirname, "..")
const DEFAULT_DB_URL = "postgresql://postgres:postgres@localhost:5432/makerworks?schema=public"

function log(msg) {
  if (process.env.LOG_BACKUPS === "false") return
  process.stdout.write(`[backup] ${msg}\n`)
}

function resolveStorageDir() {
  const envRoot = process.env.STORAGE_DIR
  if (envRoot && fs.existsSync(envRoot)) return path.resolve(envRoot)
  return path.join(projectRoot, "storage")
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function resolveBackupsDir(storageDir = resolveStorageDir(), explicitDir) {
  if (explicitDir) return path.resolve(explicitDir)
  if (process.env.BACKUP_DIR) return path.resolve(process.env.BACKUP_DIR)
  return path.join(storageDir, "backups")
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

function spawnWithStdout(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, options)
  if (result.error) {
    throw new Error(result.error.message || `${cmd} failed to start`)
  }
  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString() : ""
    throw new Error(stderr || `${cmd} exited with ${result.status}`)
  }
  return result.stdout
}

function shouldUseShell(cmd) {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd)
}

function buildWindowsCommand(cmd, args) {
  return `"${cmd}" ${args.join(" ")}`
}

function commandAvailable(cmd) {
  if (shouldUseShell(cmd)) {
    const comspec = process.env.ComSpec || "cmd.exe"
    const result = spawnSync(comspec, ["/d", "/s", "/c", buildWindowsCommand(cmd, ["--version"])], { encoding: "utf8" })
    if (result.error) return false
    return result.status === 0
  }
  const result = spawnSync(cmd, ["--version"], { encoding: "utf8" })
  if (result.error) return false
  return result.status === 0
}

function resolvePgDumpCommand() {
  return process.env.PG_DUMP_BIN || "pg_dump"
}

function getDockerComposeCommand() {
  if (process.env.SKIP_DOCKER === "1") return null
  const composeBin = process.env.DOCKER_COMPOSE_BIN
  if (composeBin) {
    const res = spawnSync(composeBin, ["version"], { encoding: "utf8" })
    if (res.status === 0) return { cmd: composeBin, args: [] }
  }
  const dockerBin = process.env.DOCKER_BIN || "docker"
  const v2 = spawnSync(dockerBin, ["compose", "version"], { encoding: "utf8" })
  if (v2.status === 0) return { cmd: dockerBin, args: ["compose"] }
  const v1 = spawnSync("docker-compose", ["version"], { encoding: "utf8" })
  if (v1.status === 0) return { cmd: "docker-compose", args: [] }
  return null
}

function tryDockerDump(destFile) {
  const compose = getDockerComposeCommand()
  if (!compose) {
    log("Docker compose not available; skipping docker backup.")
    return false
  }
  const info = getDbInfo()
  log("Attempting pg_dump via docker compose.")
  const env = { ...process.env }
  if (info.password) env.PGPASSWORD = info.password
  const args = [
    ...compose.args,
    "exec",
    "-T",
    "db",
    "pg_dump",
    "-U",
    info.user || "postgres",
    info.database,
  ]
  const result = spawnSync(compose.cmd, args, {
    cwd: projectRoot,
    env,
    encoding: "buffer",
  })
  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString() : ""
    if (stderr) log(`Docker pg_dump failed: ${stderr.trim()}`)
    log("Docker pg_dump failed; falling back to local pg_dump if available.")
    return false
  }
  fs.writeFileSync(destFile, result.stdout)
  return true
}

function localPgDump(destFile, cmd = resolvePgDumpCommand()) {
  const info = getDbInfo()
  log(`Running pg_dump against ${info.host}:${info.port}/${info.database}`)
  const env = { ...process.env }
  if (info.password) env.PGPASSWORD = info.password
  const args = ["-h", info.host, "-p", info.port, "-U", info.user, info.database]
  let stdout
  if (shouldUseShell(cmd)) {
    const comspec = process.env.ComSpec || "cmd.exe"
    stdout = spawnWithStdout(comspec, ["/d", "/s", "/c", buildWindowsCommand(cmd, args)], {
      cwd: projectRoot,
      env,
      encoding: "buffer",
    })
  } else {
    stdout = spawnWithStdout(cmd, args, {
      cwd: projectRoot,
      env,
      encoding: "buffer",
    })
  }
  fs.writeFileSync(destFile, stdout)
}

function copyStorage(storageDir, targetDir) {
  if (!fs.existsSync(storageDir)) {
    log("No storage directory found; skipping file backup.")
    return
  }
  const dest = path.join(targetDir, "storage")
  ensureDir(dest)
  const entries = fs.readdirSync(storageDir, { withFileTypes: true })
  log("Copying storage directory.")
  for (const entry of entries) {
    if (entry.name === "backups") continue
    const srcPath = path.join(storageDir, entry.name)
    const destPath = path.join(dest, entry.name)
    fs.cpSync(srcPath, destPath, { recursive: true })
  }
  log("Storage copied.")
}

function runBackup(options = {}) {
  const storageDir = resolveStorageDir()
  const backupsRoot = resolveBackupsDir(storageDir, options.backupDir)
  ensureDir(backupsRoot)
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const targetDir = path.join(backupsRoot, timestamp)
  ensureDir(targetDir)

  const destFile = path.join(targetDir, "db.sql")
  if (!tryDockerDump(destFile)) {
    const pgDumpCmd = resolvePgDumpCommand()
    if (!commandAvailable(pgDumpCmd)) {
      throw new Error("pg_dump is not available. Install the PostgreSQL client tools or run backups with docker compose running.")
    }
    localPgDump(destFile, pgDumpCmd)
  }
  copyStorage(storageDir, targetDir)
  log(`Backup complete: ${targetDir}`)
  return targetDir
}

function listBackups() {
  const storageDir = resolveStorageDir()
  const backupsDir = resolveBackupsDir(storageDir)
  if (!fs.existsSync(backupsDir)) return []
  const entries = fs.readdirSync(backupsDir, { withFileTypes: true }).filter((d) => d.isDirectory())
  return entries
    .map((entry) => {
      const dir = path.join(backupsDir, entry.name)
      const stats = fs.statSync(dir)
      return {
        folder: entry.name,
        createdAt: stats.mtime.toISOString(),
        hasStorage: fs.existsSync(path.join(dir, "storage")),
        hasDatabase: fs.existsSync(path.join(dir, "db.sql")),
        absolutePath: dir,
        relativePath: path.relative(storageDir, dir).replace(/\\/g, "/"),
      }
    })
    .sort((a, b) => (a.folder < b.folder ? 1 : -1))
}

function getPendingRestore() {
  const storageDir = resolveStorageDir()
  const backupsDir = resolveBackupsDir(storageDir)
  const manifest = path.join(backupsDir, "pending-restore.json")
  if (!fs.existsSync(manifest)) return null
  try {
    const payload = JSON.parse(fs.readFileSync(manifest, "utf8"))
    const absoluteBackup = path.isAbsolute(payload.backupPath)
      ? payload.backupPath
      : path.join(storageDir, payload.backupPath || "")
    return {
      ...payload,
      manifest,
      absoluteBackup,
      relativePath: path.relative(storageDir, absoluteBackup).replace(/\\/g, "/"),
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
  if (!fs.statSync(target).isDirectory()) throw new Error("Backup folder not found.")
  const dbFile = path.join(target, "db.sql")
  if (!fs.existsSync(dbFile)) throw new Error("Backup missing db.sql")
  const manifest = path.join(backupsDir, "pending-restore.json")
  const payload = {
    backupPath: path.relative(storageDir, target).replace(/\\/g, "/"),
    createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(manifest, JSON.stringify(payload, null, 2))
  return payload
}

function runSql(sql) {
  const info = getDbInfo()
  const env = { ...process.env }
  if (info.password) env.PGPASSWORD = info.password
  const args = ["-v", "ON_ERROR_STOP=1", "-U", info.user, info.database, "-c", sql]
  const compose = getDockerComposeCommand()
  if (compose) {
    const dockerArgs = [...compose.args, "exec", "-T", "db", "psql", ...args]
    const res = spawnSync(compose.cmd, dockerArgs, { cwd: projectRoot, env })
    if (res.status === 0) return
  }
  if (!commandAvailable("psql")) {
    throw new Error("psql is not available. Install the PostgreSQL client tools or run restores with docker compose running.")
  }
  const psqlArgs = ["-h", info.host, "-p", info.port, "-U", info.user, "-v", "ON_ERROR_STOP=1", info.database, "-c", sql]
  spawnWithStdout("psql", psqlArgs, { env })
}

function restoreSqlFile(sqlFile) {
  const info = getDbInfo()
  const env = { ...process.env }
  if (info.password) env.PGPASSWORD = info.password
  const args = ["-v", "ON_ERROR_STOP=1", "-U", info.user, info.database]
  const body = fs.readFileSync(sqlFile)
  const compose = getDockerComposeCommand()
  if (compose) {
    const dockerArgs = [...compose.args, "exec", "-T", "db", "psql", ...args]
    const res = spawnSync(compose.cmd, dockerArgs, { cwd: projectRoot, env, input: body })
    if (res.status === 0) return
  }
  if (!commandAvailable("psql")) {
    throw new Error("psql is not available. Install the PostgreSQL client tools or run restores with docker compose running.")
  }
  const psqlArgs = ["-h", info.host, "-p", info.port, "-U", info.user, "-v", "ON_ERROR_STOP=1", info.database]
  spawnWithStdout("psql", psqlArgs, { env, input: body })
}

function cleanStorage(storageDir) {
  ensureDir(storageDir)
  const entries = fs.readdirSync(storageDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === "backups") continue
    fs.rmSync(path.join(storageDir, entry.name), { recursive: true, force: true })
  }
}

function copyFromBackup(sourceDir, storageDir) {
  const dataDir = path.join(sourceDir, "storage")
  if (!fs.existsSync(dataDir)) return
  fs.cpSync(dataDir, storageDir, { recursive: true })
}

function applyPendingRestore() {
  const pending = getPendingRestore()
  if (!pending) return null
  const storageDir = resolveStorageDir()
  const backupDir = pending.absoluteBackup
  if (!backupDir || !fs.existsSync(backupDir)) {
    fs.rmSync(pending.manifest, { force: true })
    throw new Error("Pending restore backup missing.")
  }
  const sqlFile = path.join(backupDir, "db.sql")
  if (!fs.existsSync(sqlFile)) {
    fs.rmSync(pending.manifest, { force: true })
    throw new Error("Backup missing db.sql")
  }
  runSql("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
  restoreSqlFile(sqlFile)
  cleanStorage(storageDir)
  copyFromBackup(backupDir, storageDir)
  fs.rmSync(pending.manifest, { force: true })
  return { backupPath: pending.relativePath }
}

module.exports = {
  runBackup,
  listBackups,
  scheduleRestore,
  getPendingRestore,
  applyPendingRestore,
  resolveStorageDir,
  resolveBackupsDir,
}
