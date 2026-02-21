"use strict"

const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const projectRoot = path.resolve(__dirname, "..")
const DEFAULT_DB_URL = "postgresql://postgres:postgres@localhost:5432/makerworks?schema=public"
const DEFAULT_BACKUP_RETENTION_DAYS = 14
const DEFAULT_BACKUP_RETENTION_MAX_COUNT = 30
const DEFAULT_BACKUP_SCHEDULE_TIME_UTC = "03:00"

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

function parsePositiveInt(value, fallback = 0) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, parsed)
}

function parseScheduleTimeUtc(rawValue = process.env.BACKUP_SCHEDULE_TIME_UTC || DEFAULT_BACKUP_SCHEDULE_TIME_UTC) {
  const value = `${rawValue || ""}`.trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return { hour: 3, minute: 0, value: DEFAULT_BACKUP_SCHEDULE_TIME_UTC, valid: false }
  const hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: 3, minute: 0, value: DEFAULT_BACKUP_SCHEDULE_TIME_UTC, valid: false }
  }
  return { hour, minute, value: `${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")}`, valid: true }
}

function getBackupPolicy() {
  const retentionDays = parsePositiveInt(process.env.BACKUP_RETENTION_DAYS, DEFAULT_BACKUP_RETENTION_DAYS)
  const retentionMaxCount = parsePositiveInt(process.env.BACKUP_RETENTION_MAX_COUNT, DEFAULT_BACKUP_RETENTION_MAX_COUNT)
  const scheduleEnabled = `${process.env.BACKUP_SCHEDULE_ENABLED || "0"}` === "1"
  const pruneOnBackup = `${process.env.BACKUP_PRUNE_ON_BACKUP || "1"}` !== "0"
  const runOnStart = `${process.env.BACKUP_RUN_ON_START || "0"}` === "1"
  const schedule = parseScheduleTimeUtc()
  return {
    retentionDays,
    retentionMaxCount,
    scheduleEnabled,
    scheduleTimeUtc: schedule.value,
    scheduleTimeValid: schedule.valid,
    pruneOnBackup,
    runOnStart,
  }
}

function getNextScheduledBackupAt(now = new Date(), policy = getBackupPolicy()) {
  const schedule = parseScheduleTimeUtc(policy.scheduleTimeUtc)
  const next = new Date(now)
  next.setUTCHours(schedule.hour, schedule.minute, 0, 0)
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1)
  }
  return next
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

function quoteWindowsShellArg(value) {
  const str = `${value}`
  if (!str) return '""'
  if (!/[\s^&|<>()%!"]/u.test(str)) return str
  return `"${str.replace(/"/g, '""')}"`
}

function buildWindowsShellCommand(cmd, args = []) {
  return [quoteWindowsShellArg(cmd), ...args.map((arg) => quoteWindowsShellArg(arg))].join(" ")
}

function commandAvailable(cmd) {
  if (!cmd) return false
  if ((path.isAbsolute(cmd) || cmd.includes("\\") || cmd.includes("/")) && fs.existsSync(cmd)) {
    return true
  }
  if (shouldUseShell(cmd)) {
    const commandLine = buildWindowsShellCommand(cmd, ["--version"])
    const result = spawnSync(commandLine, { encoding: "utf8", shell: true })
    if (result.error) return false
    return result.status === 0
  }
  const result = spawnSync(cmd, ["--version"], { encoding: "utf8" })
  if (result.error) {
    if (process.platform === "win32" && !cmd.includes("\\") && !cmd.includes("/")) {
      const commandLine = buildWindowsShellCommand(cmd, ["--version"])
      const shellResult = spawnSync(commandLine, { encoding: "utf8", shell: true })
      if (!shellResult.error) return shellResult.status === 0
    }
    return false
  }
  return result.status === 0
}

function resolvePgDumpCommand() {
  const explicit = `${process.env.PG_DUMP_BIN || ""}`.trim()
  if (explicit) {
    if (commandAvailable(explicit)) return explicit
    log(`PG_DUMP_BIN is set but unavailable at '${explicit}'. Falling back to auto-detect.`)
  }
  if (commandAvailable("pg_dump")) return "pg_dump"
  if (process.platform !== "win32") return "pg_dump"

  const candidates = getWindowsPostgresBinaryCandidates("pg_dump.exe")
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && commandAvailable(candidate)) {
      log(`Using pg_dump from ${candidate}`)
      return candidate
    }
  }
  return "pg_dump"
}

function getWindowsPostgresBinaryCandidates(binaryName) {
  const candidates = []
  const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean)

  for (const root of roots) {
    const base = path.join(root, "PostgreSQL")
    if (!fs.existsSync(base)) continue
    let versions = []
    try {
      versions = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    } catch {
      versions = []
    }
    // Prefer latest versions first (e.g., 17, 16, 15)
    versions.sort((a, b) => compareVersionNames(b, a))
    for (const version of versions) {
      candidates.push(path.join(base, version, "bin", binaryName))
    }
  }

  const pgConfig = process.env.PG_CONFIG_BIN || "pg_config"
  if (commandAvailable(pgConfig)) {
    try {
      const bindirRaw = spawnWithStdout(pgConfig, ["--bindir"], { encoding: "utf8" }).toString()
      const bindir = bindirRaw.trim()
      if (bindir) candidates.unshift(path.join(bindir, binaryName))
    } catch {
      // ignore pg_config probing errors
    }
  }

  return Array.from(new Set(candidates))
}

function compareVersionNames(a, b) {
  const aParts = `${a}`.split(".").map((part) => Number.parseInt(part, 10))
  const bParts = `${b}`.split(".").map((part) => Number.parseInt(part, 10))
  const len = Math.max(aParts.length, bParts.length)
  for (let i = 0; i < len; i += 1) {
    const left = Number.isFinite(aParts[i]) ? aParts[i] : 0
    const right = Number.isFinite(bParts[i]) ? bParts[i] : 0
    if (left !== right) return left - right
  }
  return 0
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

function getDockerDbService() {
  return process.env.BACKUP_DOCKER_SERVICE || "db"
}

function isDockerBackupSkipped() {
  return `${process.env.SKIP_DOCKER || "0"}` === "1"
}

function probeDockerClientTool(tool) {
  if (isDockerBackupSkipped()) {
    return { ok: false, reason: null, compose: null, skipped: true }
  }
  const compose = getDockerComposeCommand()
  if (!compose) {
    return { ok: false, reason: "Docker Compose unavailable", compose: null, skipped: false }
  }
  const service = getDockerDbService()
  const args = [...compose.args, "exec", "-T", service, tool, "--version"]
  const res = spawnSync(compose.cmd, args, { cwd: projectRoot, encoding: "utf8" })
  if (res.status === 0) {
    return { ok: true, reason: null, compose, service, skipped: false }
  }
  const stderr = (res.stderr || "").trim()
  const stdout = (res.stdout || "").trim()
  const detail = stderr || stdout || `${tool} probe failed`
  return { ok: false, reason: `Docker ${tool} unavailable for service '${service}': ${detail}`, compose, service, skipped: false }
}

function resolvePsqlCommand() {
  const explicit = `${process.env.PSQL_BIN || ""}`.trim()
  if (explicit) {
    if (commandAvailable(explicit)) return explicit
    log(`PSQL_BIN is set but unavailable at '${explicit}'. Falling back to auto-detect.`)
  }
  if (commandAvailable("psql")) return "psql"
  if (process.platform !== "win32") return "psql"
  const candidates = getWindowsPostgresBinaryCandidates("psql.exe")
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && commandAvailable(candidate)) {
      log(`Using psql from ${candidate}`)
      return candidate
    }
  }
  return "psql"
}

function getBackupReadiness() {
  const docker = probeDockerClientTool("pg_dump")
  const pgDumpCmd = resolvePgDumpCommand()
  const pgDumpAvailable = commandAvailable(pgDumpCmd)
  const mode = docker.ok ? "docker" : pgDumpAvailable ? "local" : "unavailable"
  const reasons = []
  if (!docker.ok && docker.reason && !docker.skipped) reasons.push(docker.reason)
  if (!pgDumpAvailable) reasons.push("pg_dump unavailable")
  return {
    ok: mode !== "unavailable",
    mode,
    dockerComposeAvailable: Boolean(docker.compose),
    dockerPgDumpAvailable: docker.ok,
    dockerService: docker.service || getDockerDbService(),
    pgDumpAvailable,
    pgDumpCommand: pgDumpCmd,
    reasons,
  }
}

function getRestoreReadiness() {
  const docker = probeDockerClientTool("psql")
  const psqlCmd = resolvePsqlCommand()
  const psqlAvailable = commandAvailable(psqlCmd)
  const mode = docker.ok ? "docker" : psqlAvailable ? "local" : "unavailable"
  const reasons = []
  if (!docker.ok && docker.reason && !docker.skipped) reasons.push(docker.reason)
  if (!psqlAvailable) reasons.push("psql unavailable")
  return {
    ok: mode !== "unavailable",
    mode,
    dockerComposeAvailable: Boolean(docker.compose),
    dockerPsqlAvailable: docker.ok,
    dockerService: docker.service || getDockerDbService(),
    psqlAvailable,
    psqlCommand: psqlCmd,
    reasons,
  }
}

function tryDockerDump(destFile) {
  const compose = getDockerComposeCommand()
  if (!compose) {
    log("Docker compose not available; skipping docker backup.")
    return false
  }
  const service = getDockerDbService()
  const info = getDbInfo()
  log(`Attempting pg_dump via docker compose service '${service}'.`)
  const env = { ...process.env }
  if (info.password) env.PGPASSWORD = info.password
  const args = [
    ...compose.args,
    "exec",
    "-T",
    service,
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
  const useWindowsShell =
    shouldUseShell(cmd) || (process.platform === "win32" && !path.isAbsolute(cmd) && !cmd.includes("\\") && !cmd.includes("/"))
  if (useWindowsShell) {
    const commandLine = buildWindowsShellCommand(cmd, args)
    stdout = spawnWithStdout(commandLine, [], {
      cwd: projectRoot,
      env,
      encoding: "buffer",
      shell: true,
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
  try {
    const destFile = path.join(targetDir, "db.sql")
    if (!tryDockerDump(destFile)) {
      const readiness = getBackupReadiness()
      if (!readiness.pgDumpAvailable) {
        throw new Error(
          "pg_dump is not available. Install PostgreSQL client tools, add pg_dump to PATH, or set PG_DUMP_BIN to the full pg_dump executable path.",
        )
      }
      try {
        localPgDump(destFile, readiness.pgDumpCommand)
      } catch (err) {
        const message = err?.message || ""
        if (/ENOENT/i.test(message)) {
          const dockerContext =
            readiness?.dockerComposeAvailable || readiness?.dockerPgDumpAvailable
              ? `Docker/compose backup attempt was not usable (${(readiness?.reasons || []).join(", ") || "unknown docker error"}), and local pg_dump fallback '${readiness?.pgDumpCommand || "pg_dump"}' could not be executed.`
              : `Local pg_dump fallback '${readiness?.pgDumpCommand || "pg_dump"}' could not be executed.`
          throw new Error(
            `${dockerContext} Set PG_DUMP_BIN to a valid executable path (for example: /usr/lib/postgresql/15/bin/pg_dump on Linux or C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe on Windows).`,
          )
        }
        throw err
      }
    }
    copyStorage(storageDir, targetDir)
  } catch (err) {
    fs.rmSync(targetDir, { recursive: true, force: true })
    throw err
  }
  const policy = getBackupPolicy()
  if (options.prune !== false && policy.pruneOnBackup) {
    try {
      pruneBackups({ backupDir: backupsRoot })
    } catch (err) {
      log(`Backup prune failed: ${err?.message || err}`)
    }
  }
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
        modifiedAtMs: stats.mtimeMs,
        hasStorage: fs.existsSync(path.join(dir, "storage")),
        hasDatabase: fs.existsSync(path.join(dir, "db.sql")),
        absolutePath: dir,
        relativePath: path.relative(storageDir, dir).replace(/\\/g, "/"),
      }
    })
    .sort((a, b) => b.modifiedAtMs - a.modifiedAtMs || (a.folder < b.folder ? 1 : -1))
    .map(({ modifiedAtMs, ...backup }) => backup)
}

function pruneBackups(options = {}) {
  const storageDir = resolveStorageDir()
  const backupsDir = resolveBackupsDir(storageDir, options.backupDir)
  if (!fs.existsSync(backupsDir)) {
    return { deleted: [], kept: [], retainedByDays: 0, retainedByCount: 0, protected: [] }
  }
  const basePolicy = getBackupPolicy()
  const retentionDays = typeof options.retentionDays === "number" ? Math.max(0, options.retentionDays) : basePolicy.retentionDays
  const retentionMaxCount =
    typeof options.retentionMaxCount === "number" ? Math.max(0, options.retentionMaxCount) : basePolicy.retentionMaxCount
  const cutoffMs = retentionDays > 0 ? Date.now() - retentionDays * 24 * 60 * 60 * 1000 : null
  const pending = getPendingRestore()
  const protectedPath = pending?.absoluteBackup ? path.resolve(pending.absoluteBackup) : null
  const backups = fs
    .readdirSync(backupsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((entry) => {
      const dir = path.join(backupsDir, entry.name)
      const stats = fs.statSync(dir)
      return {
        folder: entry.name,
        absolutePath: dir,
        modifiedAtMs: stats.mtimeMs,
      }
    })
    .sort((a, b) => b.modifiedAtMs - a.modifiedAtMs || (a.folder < b.folder ? 1 : -1))

  if (retentionDays === 0 && retentionMaxCount === 0) {
    return {
      deleted: [],
      kept: backups.map((b) => b.folder),
      retainedByDays: 0,
      retainedByCount: 0,
      protected: protectedPath ? [path.basename(protectedPath)] : [],
    }
  }

  const deleted = []
  const kept = []
  const protectedBackups = []
  let retainedByCount = 0
  let retainedByDays = 0

  backups.forEach((backup, index) => {
    const isProtected = protectedPath && path.resolve(backup.absolutePath) === protectedPath
    const keepByCount = retentionMaxCount > 0 && index < retentionMaxCount
    const keepByDays = cutoffMs !== null && backup.modifiedAtMs >= cutoffMs
    if (keepByCount) retainedByCount += 1
    if (keepByDays) retainedByDays += 1

    if (isProtected || keepByCount || keepByDays) {
      kept.push(backup.folder)
      if (isProtected) protectedBackups.push(backup.folder)
      return
    }
    fs.rmSync(backup.absolutePath, { recursive: true, force: true })
    deleted.push(backup.folder)
  })

  if (deleted.length > 0) {
    log(`Pruned ${deleted.length} backup(s) using retention policy: ${retentionDays}d / max ${retentionMaxCount}.`)
  }
  return {
    deleted,
    kept,
    retainedByDays,
    retainedByCount,
    protected: protectedBackups,
  }
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
    const dockerArgs = [...compose.args, "exec", "-T", getDockerDbService(), "psql", ...args]
    const res = spawnSync(compose.cmd, dockerArgs, { cwd: projectRoot, env })
    if (res.status === 0) return
  }
  const psqlCmd = resolvePsqlCommand()
  if (!commandAvailable(psqlCmd)) {
    throw new Error("psql is not available. Install the PostgreSQL client tools or run restores with docker compose running.")
  }
  const psqlArgs = ["-h", info.host, "-p", info.port, "-U", info.user, "-v", "ON_ERROR_STOP=1", info.database, "-c", sql]
  spawnWithStdout(psqlCmd, psqlArgs, { env })
}

function restoreSqlFile(sqlFile) {
  const info = getDbInfo()
  const env = { ...process.env }
  if (info.password) env.PGPASSWORD = info.password
  const args = ["-v", "ON_ERROR_STOP=1", "-U", info.user, info.database]
  const body = fs.readFileSync(sqlFile)
  const compose = getDockerComposeCommand()
  if (compose) {
    const dockerArgs = [...compose.args, "exec", "-T", getDockerDbService(), "psql", ...args]
    const res = spawnSync(compose.cmd, dockerArgs, { cwd: projectRoot, env, input: body })
    if (res.status === 0) return
  }
  const psqlCmd = resolvePsqlCommand()
  if (!commandAvailable(psqlCmd)) {
    throw new Error("psql is not available. Install the PostgreSQL client tools or run restores with docker compose running.")
  }
  const psqlArgs = ["-h", info.host, "-p", info.port, "-U", info.user, "-v", "ON_ERROR_STOP=1", info.database]
  spawnWithStdout(psqlCmd, psqlArgs, { env, input: body })
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
  pruneBackups,
  listBackups,
  scheduleRestore,
  getPendingRestore,
  applyPendingRestore,
  resolveStorageDir,
  resolveBackupsDir,
  getBackupPolicy,
  getNextScheduledBackupAt,
  getBackupReadiness,
  getRestoreReadiness,
}
