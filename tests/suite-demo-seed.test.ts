import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildPrintLabFixtures,
  explainDatabaseTarget,
  resolveSiblingRepoPath,
  resolveSuiteDemoPaths,
} from '../scripts/suite-demo-seed'

test('resolveSiblingRepoPath resolves suite repos beside MakerWorks', () => {
  const root = path.join('C:', 'Users', 'steph', 'OneDrive', 'Documents', 'GitHub', 'mkwV2')
  const stockworks = resolveSiblingRepoPath(root, 'stockworks')

  assert.equal(stockworks, path.join('C:', 'Users', 'steph', 'OneDrive', 'Documents', 'GitHub', 'stockworks'))
})

test('resolveSuiteDemoPaths keeps PrintLab fixtures in the configured data directory', () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'suite-demo-'))
  const paths = resolveSuiteDemoPaths({
    makerworksRoot: tempRoot,
    env: { SUITE_DEMO_PRINTLAB_DATA_DIR: path.join(tempRoot, 'printlab-data') },
  })

  assert.equal(paths.printlabDataDir, path.join(tempRoot, 'printlab-data'))
  assert.equal(paths.screenshotDir, path.join(tempRoot, 'docs', 'wiki', 'assets', 'suite-screenshots'))
})

test('buildPrintLabFixtures creates deterministic demo job files', () => {
  const fixtures = buildPrintLabFixtures()
  const names = fixtures.map((fixture) => fixture.filename).sort()

  assert.deepEqual(names, [
    'queue_demo-x1c.json',
    'submitted_jobs_demo-x1c.json',
    'successful_gcodes_demo-x1c.json',
  ])
  assert.match(JSON.stringify(fixtures), /MW-DEMO-1001/)
  assert.match(JSON.stringify(fixtures), /PL-DEMO-1001/)
})

test('explainDatabaseTarget identifies Docker-only database hostnames', () => {
  const explanation = explainDatabaseTarget('postgresql://postgres:secret@db:5432/makerworks')

  assert.equal(explanation.host, 'db')
  assert.equal(explanation.reachableFromLocalShell, false)
  assert.match(explanation.message, /Docker Compose service hostname/)
})
