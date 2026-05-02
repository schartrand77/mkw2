import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildDemoModelFiles,
  buildPrintLabPrintersFixture,
  buildPrintLabFixtures,
  buildStockWorksDemoPayloads,
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

test('buildPrintLabPrintersFixture creates a large synthetic printer fleet', () => {
  const printers = buildPrintLabPrintersFixture()

  assert.ok(printers.length >= 8)
  assert.ok(printers.every((printer) => String(printer.id).startsWith('demo-')))
  assert.match(JSON.stringify(printers), /Demo X1 Carbon/)
})

test('buildStockWorksDemoPayloads creates rich inventory and transaction samples', () => {
  const payloads = buildStockWorksDemoPayloads()

  assert.ok(payloads.materials.length >= 10)
  assert.ok(payloads.inventory.length >= 10)
  assert.ok(payloads.hardware.length >= 10)
  assert.ok(payloads.movements.length >= 20)
  assert.match(JSON.stringify(payloads), /MW-DEMO-1001/)
})

test('buildDemoModelFiles creates a real STL preview target for the model viewer', () => {
  const files = buildDemoModelFiles()

  assert.equal(files.modelPath, 'demo/suite/parametric-enclosure-kit.stl')
  assert.equal(files.viewerPath, files.modelPath)
  assert.match(files.stlContent, /^solid makerworks_demo_enclosure/)
  assert.match(files.stlContent, /endsolid makerworks_demo_enclosure\s*$/)
})

test('buildDemoModelFiles includes legacy cached viewer paths with STL content', () => {
  const files = buildDemoModelFiles()

  assert.deepEqual(files.compatibilityPaths.sort(), [
    'demo/parametric-enclosure-kit.3mf',
    'demo/parametric-enclosure-kit.glb',
  ])
})

test('explainDatabaseTarget identifies Docker-only database hostnames', () => {
  const explanation = explainDatabaseTarget('postgresql://postgres:secret@db:5432/makerworks')

  assert.equal(explanation.host, 'db')
  assert.equal(explanation.reachableFromLocalShell, false)
  assert.match(explanation.message, /Docker Compose service hostname/)
})
