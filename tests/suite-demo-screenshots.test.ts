import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildCaptureTargets,
  isOptionalCapture,
  resolveCaptureConfig,
  resolveScreenshotPath,
} from '../scripts/capture-suite-screenshots'

test('resolveCaptureConfig uses local suite defaults', () => {
  const config = resolveCaptureConfig({ makerworksRoot: process.cwd(), env: {} })

  assert.equal(config.urls.MakerWorks, 'http://localhost:3000')
  assert.equal(config.urls.StockWorks, 'http://localhost:8000')
  assert.equal(config.urls.PrintLab, 'http://localhost:8289')
})

test('resolveScreenshotPath keeps output under suite screenshot directory', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'suite-capture-'))
  const config = resolveCaptureConfig({ makerworksRoot: root, env: {} })
  const output = resolveScreenshotPath(config, 'makerworks-01-home.png')

  assert.equal(output, path.join(root, 'docs', 'wiki', 'assets', 'suite-screenshots', 'makerworks-01-home.png'))
  assert.throws(() => resolveScreenshotPath(config, '../escape.png'), /Invalid screenshot filename/)
})

test('buildCaptureTargets maps manifest entries to app URLs', () => {
  const config = resolveCaptureConfig({ makerworksRoot: process.cwd(), env: {} })
  const targets = buildCaptureTargets(config)
  const home = targets.find((target) => target.filename === 'makerworks-01-home.png')

  assert.equal(home?.url, 'http://localhost:3000/')
})

test('isOptionalCapture follows manifest optional flag', () => {
  assert.equal(isOptionalCapture({ optional: true }), true)
  assert.equal(isOptionalCapture({ optional: false }), false)
  assert.equal(isOptionalCapture({}), false)
})
