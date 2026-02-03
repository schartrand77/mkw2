import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runBackup, listBackups, scheduleRestore, getPendingRestore } = require('../lib/backups')

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'makerworks-backup-'))
}

function writeFakePgDump(binDir: string) {
  if (process.platform === 'win32') {
    const cmdPath = path.join(binDir, 'pg_dump.cmd')
    fs.writeFileSync(
      cmdPath,
      [
        '@echo off',
        'if "%1"=="--version" (',
        '  echo pg_dump (PostgreSQL) 16.0',
        '  exit /B 0',
        ')',
        'echo -- mock pg_dump',
        '',
      ].join('\r\n'),
    )
    return cmdPath
  }
  const shPath = path.join(binDir, 'pg_dump')
  fs.writeFileSync(
    shPath,
    ['#!/bin/sh', 'if [ "$1" = "--version" ]; then', '  echo "pg_dump (PostgreSQL) 16.0"', '  exit 0', 'fi', 'echo "-- mock pg_dump"', ''].join('\n'),
    { mode: 0o755 },
  )
  return shPath
}

test('runBackup writes db.sql and copies storage contents', () => {
  const tempRoot = makeTempDir()
  const binDir = path.join(tempRoot, 'bin')
  const storageDir = path.join(tempRoot, 'storage')
  fs.mkdirSync(binDir, { recursive: true })
  fs.mkdirSync(storageDir, { recursive: true })
  fs.mkdirSync(path.join(storageDir, 'uploads'), { recursive: true })
  fs.mkdirSync(path.join(storageDir, 'backups', 'old-backup'), { recursive: true })
  fs.writeFileSync(path.join(storageDir, 'uploads', 'sample.txt'), 'ok', 'utf8')
  const pgDumpPath = writeFakePgDump(binDir)

  const previousPath = process.env.PATH
  const previousPathAlt = process.env.Path
  const previousStorage = process.env.STORAGE_DIR
  const previousPgDump = process.env.PG_DUMP_BIN
  const previousSkipDocker = process.env.SKIP_DOCKER
  const previousLog = process.env.LOG_BACKUPS
  const nextPath = `${binDir}${path.delimiter}${previousPath || previousPathAlt || ''}`
  process.env.PATH = nextPath
  process.env.Path = nextPath
  process.env.STORAGE_DIR = storageDir
  process.env.PG_DUMP_BIN = pgDumpPath
  process.env.SKIP_DOCKER = '1'
  process.env.LOG_BACKUPS = 'false'

  try {
    const backupDir = runBackup()
    const dbFile = path.join(backupDir, 'db.sql')
    assert.ok(fs.existsSync(dbFile), 'db.sql should exist in backup directory')

    const storageCopy = path.join(backupDir, 'storage')
    assert.ok(fs.existsSync(path.join(storageCopy, 'uploads', 'sample.txt')), 'storage files should be copied')
    assert.ok(!fs.existsSync(path.join(storageCopy, 'backups')), 'storage/backups should not be copied')

    const backups = listBackups()
    assert.ok(backups.length >= 1)
    assert.ok(backups[0].hasDatabase)
    assert.ok(backups[0].hasStorage)
  } finally {
    process.env.PATH = previousPath
    process.env.Path = previousPathAlt
    if (previousStorage === undefined) {
      delete process.env.STORAGE_DIR
    } else {
      process.env.STORAGE_DIR = previousStorage
    }
    if (previousPgDump === undefined) {
      delete process.env.PG_DUMP_BIN
    } else {
      process.env.PG_DUMP_BIN = previousPgDump
    }
    if (previousSkipDocker === undefined) {
      delete process.env.SKIP_DOCKER
    } else {
      process.env.SKIP_DOCKER = previousSkipDocker
    }
    if (previousLog === undefined) {
      delete process.env.LOG_BACKUPS
    } else {
      process.env.LOG_BACKUPS = previousLog
    }
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})

test('scheduleRestore creates pending restore manifest', () => {
  const tempRoot = makeTempDir()
  const binDir = path.join(tempRoot, 'bin')
  const storageDir = path.join(tempRoot, 'storage')
  fs.mkdirSync(binDir, { recursive: true })
  fs.mkdirSync(storageDir, { recursive: true })
  const pgDumpPath = writeFakePgDump(binDir)

  const previousPath = process.env.PATH
  const previousPathAlt = process.env.Path
  const previousStorage = process.env.STORAGE_DIR
  const previousPgDump = process.env.PG_DUMP_BIN
  const previousSkipDocker = process.env.SKIP_DOCKER
  const previousLog = process.env.LOG_BACKUPS
  const nextPath = `${binDir}${path.delimiter}${previousPath || previousPathAlt || ''}`
  process.env.PATH = nextPath
  process.env.Path = nextPath
  process.env.STORAGE_DIR = storageDir
  process.env.PG_DUMP_BIN = pgDumpPath
  process.env.SKIP_DOCKER = '1'
  process.env.LOG_BACKUPS = 'false'

  try {
    const backupDir = runBackup()
    const folder = path.basename(backupDir)
    const payload = scheduleRestore(folder)
    assert.ok(payload.backupPath.includes(folder))
    const pending = getPendingRestore()
    assert.ok(pending)
    assert.ok(pending?.relativePath.includes(folder))
  } finally {
    process.env.PATH = previousPath
    process.env.Path = previousPathAlt
    if (previousStorage === undefined) {
      delete process.env.STORAGE_DIR
    } else {
      process.env.STORAGE_DIR = previousStorage
    }
    if (previousPgDump === undefined) {
      delete process.env.PG_DUMP_BIN
    } else {
      process.env.PG_DUMP_BIN = previousPgDump
    }
    if (previousSkipDocker === undefined) {
      delete process.env.SKIP_DOCKER
    } else {
      process.env.SKIP_DOCKER = previousSkipDocker
    }
    if (previousLog === undefined) {
      delete process.env.LOG_BACKUPS
    } else {
      process.env.LOG_BACKUPS = previousLog
    }
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})
