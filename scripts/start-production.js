const { spawn } = require('child_process')

function runChecked(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${command} ${args.join(' ')} exited with ${signal || code}`))
    })
  })
}

function spawnRuntime(command, args, label) {
  const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  child.on('error', (err) => {
    console.error(`[startup] ${label} failed to start`, err)
  })
  child.on('exit', (code, signal) => {
    if (code === 0) {
      console.log(`[startup] ${label} exited`)
      return
    }
    console.error(`[startup] ${label} exited with ${signal || code}`)
  })
  return child
}

function shouldStartProcessingWorker() {
  const raw = String(process.env.START_PROCESSING_WORKER || '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

async function main() {
  await runChecked('node', ['scripts/restore.js'])
  await runChecked('npx', ['prisma', 'migrate', 'deploy'])
  await runChecked('node', ['scripts/bootstrap-admin.js'])

  const children = []
  if (shouldStartProcessingWorker()) {
    children.push(spawnRuntime('npm', ['run', 'worker:processing'], 'processing worker'))
  }

  const web = spawnRuntime('npx', ['next', 'start', '-p', process.env.PORT || '3000'], 'web server')
  children.push(web)

  const shutdown = (signal) => {
    for (const child of children) {
      if (!child.killed) child.kill(signal)
    }
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  web.on('exit', (code) => {
    for (const child of children) {
      if (child !== web && !child.killed) child.kill('SIGTERM')
    }
    process.exit(code || 0)
  })
}

main().catch((err) => {
  console.error('[startup] fatal', err)
  process.exit(1)
})
