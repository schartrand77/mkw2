"use strict"

const { applyPendingRestore } = require("../lib/backups")

if (require.main === module) {
  try {
    const result = applyPendingRestore()
    if (result) {
      console.log(`[restore] Applied backup from ${result.backupPath}`)
    } else {
      console.log("[restore] No pending restore.")
    }
  } catch (err) {
    console.error("[restore] Failed to apply backup:", err?.message || err)
    process.exit(1)
  }
}

module.exports = { applyPendingRestore }
