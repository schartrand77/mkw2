import { runDataRetentionCleanup } from '@/lib/data-retention'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const summary = await runDataRetentionCleanup({ dryRun })
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error('Data retention cleanup failed:', error)
  process.exitCode = 1
})
