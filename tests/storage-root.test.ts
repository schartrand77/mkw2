import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

import { storageRoot } from '../lib/storage'

const backups = require('../lib/backups')

test('default storage roots stay outside the project tree unless STORAGE_DIR is explicit', () => {
  const previous = process.env.STORAGE_DIR
  try {
    delete process.env.STORAGE_DIR
    const projectRoot = process.cwd()
    const appStorage = path.resolve(storageRoot())
    const backupStorage = path.resolve(backups.resolveStorageDir())

    assert.equal(appStorage.startsWith(projectRoot), false)
    assert.equal(backupStorage.startsWith(projectRoot), false)
  } finally {
    if (previous === undefined) delete process.env.STORAGE_DIR
    else process.env.STORAGE_DIR = previous
  }
})

