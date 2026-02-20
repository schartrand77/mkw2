"use strict"

const {
  runBackup,
  getBackupPolicy,
  getBackupReadiness,
  getNextScheduledBackupAt,
} = require("../lib/backups")

let stopping = false

function log(msg) {
  process.stdout.write(`[backup-scheduler] ${msg}\n`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitUntil(targetTimeMs) {
  while (!stopping) {
    const remaining = targetTimeMs - Date.now()
    if (remaining <= 0) return
    await sleep(Math.min(remaining, 30_000))
  }
}

function setupSignalHandlers() {
  const stop = () => {
    if (stopping) return
    stopping = true
    log("Shutdown requested. Exiting after current cycle.")
  }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
}

function runBackupCycle(reason) {
  const readiness = getBackupReadiness()
  if (!readiness.ok) {
    log(`Skipping ${reason} backup: ${(readiness.reasons || []).join(", ")}`)
    return false
  }
  const dir = runBackup()
  log(`Backup complete (${reason}): ${dir}`)
  return true
}

async function main() {
  setupSignalHandlers()
  const once = process.argv.includes("--once")

  if (once) {
    const ok = runBackupCycle("one-shot")
    process.exit(ok ? 0 : 1)
  }

  let startupBackupDone = false

  while (!stopping) {
    const currentPolicy = getBackupPolicy()
    if (!currentPolicy.scheduleEnabled) {
      log("Scheduling disabled (set BACKUP_SCHEDULE_ENABLED=1 to enable). Waiting...")
      await sleep(60_000)
      continue
    }
    log(`Scheduling enabled. Daily run time (UTC): ${currentPolicy.scheduleTimeUtc}`)
    if (!currentPolicy.scheduleTimeValid) {
      log(`Invalid BACKUP_SCHEDULE_TIME_UTC value; defaulting to ${currentPolicy.scheduleTimeUtc} UTC.`)
    }
    if (currentPolicy.runOnStart && !startupBackupDone) {
      runBackupCycle("startup")
      startupBackupDone = true
    }
    const nextRun = getNextScheduledBackupAt(new Date(), currentPolicy)
    const waitMs = Math.max(0, nextRun.getTime() - Date.now())
    log(`Next backup scheduled for ${nextRun.toISOString()}`)
    await waitUntil(Date.now() + waitMs)
    if (stopping) break
    runBackupCycle("scheduled")
  }
}

main().catch((err) => {
  log(`Fatal error: ${err?.message || err}`)
  process.exit(1)
})
