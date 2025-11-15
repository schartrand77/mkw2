"use strict"

const { runBackup } = require("../lib/backups")

if (require.main === module) {
  try {
    const dir = runBackup()
    console.log(`[backup] Backup stored at ${dir}`)
  } catch (err) {
    console.error(`[backup] ${err?.message || err}`)
    process.exit(1)
  }
}

module.exports = { runBackup }
