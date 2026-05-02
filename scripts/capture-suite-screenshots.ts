import 'dotenv/config'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Browser, BrowserContext, Page } from '@playwright/test'

import {
  SUITE_DEMO_SAMPLE,
  SUITE_DEMO_SCREENSHOTS,
  type SuiteDemoApp,
  type SuiteDemoScreenshot,
} from '@/lib/suite-demo/manifest'
import { buildPrintLabPrintersFixture, resolveSuiteDemoPaths } from './suite-demo-seed'

type Env = Record<string, string | undefined>

export type CaptureConfig = {
  makerworksRoot: string
  outputDir: string
  allowSkips: boolean
  urls: Record<Exclude<SuiteDemoApp, 'Suite Flow'>, string>
}

export type CaptureTarget = SuiteDemoScreenshot & {
  url: string
  outputPath: string
}

function cleanBaseUrl(value: string | undefined, fallback: string) {
  const raw = (value || fallback).trim().replace(/\/+$/, '')
  return raw || fallback
}

export function resolveCaptureConfig(options: { makerworksRoot?: string; env?: Env } = {}): CaptureConfig {
  const env = options.env || process.env
  const makerworksRoot = path.resolve(options.makerworksRoot || process.cwd())
  const paths = resolveSuiteDemoPaths({ makerworksRoot, env })
  return {
    makerworksRoot,
    outputDir: paths.screenshotDir,
    allowSkips: (env.SUITE_DEMO_ALLOW_SKIPS || '').trim() === '1',
    urls: {
      MakerWorks: cleanBaseUrl(env.SUITE_DEMO_MAKERWORKS_URL, 'http://localhost:3000'),
      StockWorks: cleanBaseUrl(env.SUITE_DEMO_STOCKWORKS_URL, 'http://localhost:8000'),
      PrintLab: cleanBaseUrl(env.SUITE_DEMO_PRINTLAB_URL, 'http://localhost:8289'),
    },
  }
}

export function resolveScreenshotPath(config: CaptureConfig, filename: string) {
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error(`Invalid screenshot filename: ${filename}`)
  }
  const output = path.resolve(config.outputDir, filename)
  const root = path.resolve(config.outputDir)
  if (output !== root && !output.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Screenshot output escaped asset directory: ${filename}`)
  }
  return output
}

export function isOptionalCapture(entry: Pick<SuiteDemoScreenshot, 'optional'>) {
  return entry.optional === true
}

export function buildCaptureTargets(config: CaptureConfig): CaptureTarget[] {
  return SUITE_DEMO_SCREENSHOTS
    .filter((entry) => entry.app !== 'Suite Flow')
    .map((entry) => {
      const baseUrl = config.urls[entry.app as Exclude<SuiteDemoApp, 'Suite Flow'>]
      return {
        ...entry,
        url: new URL(entry.path, `${baseUrl}/`).toString(),
        outputPath: resolveScreenshotPath(config, entry.filename),
      }
    })
}

async function appReachable(url: string) {
  try {
    const response = await fetch(url, { method: 'GET' })
    return response.status < 500
  } catch {
    return false
  }
}

async function loginMakerWorks(context: BrowserContext, baseUrl: string, env: Env) {
  const email = env.SUITE_DEMO_MAKERWORKS_EMAIL || SUITE_DEMO_SAMPLE.adminEmail
  const password = env.SUITE_DEMO_MAKERWORKS_PASSWORD || 'SuiteDemoPassword123!'
  await context.request.post(new URL('/api/login', `${baseUrl}/`).toString(), {
    data: { email, password },
  }).catch(() => null)
}

async function loginStockWorks(page: Page, baseUrl: string, env: Env) {
  const username = env.STOCKWORKS_ADMIN_USERNAME || env.STOCKWORKS_USERNAME
  const password = env.STOCKWORKS_ADMIN_PASSWORD || env.STOCKWORKS_PASSWORD
  if (!username || !password) return
  await page.goto(new URL('/login', `${baseUrl}/`).toString(), { waitUntil: 'domcontentloaded' }).catch(() => null)
  const usernameInput = page.locator('input[name="username"], #username').first()
  if (!(await usernameInput.count())) return
  await usernameInput.fill(username)
  await page.locator('input[name="password"], #password').first().fill(password)
  await page.locator('button[type="submit"], input[type="submit"]').first().click()
  await page.waitForLoadState('domcontentloaded').catch(() => null)
}

async function loginPrintLab(page: Page, baseUrl: string, env: Env) {
  const username = env.PRINTLAB_ADMIN_USERNAME || env.ADMIN_USERNAME
  const password = env.PRINTLAB_ADMIN_PASSWORD || env.ADMIN_PASSWORD
  if (!username || !password) return
  await page.goto(new URL('/login', `${baseUrl}/`).toString(), { waitUntil: 'domcontentloaded' }).catch(() => null)
  const usernameInput = page.locator('input[name="username"], #username').first()
  if (!(await usernameInput.count())) return
  await usernameInput.fill(username)
  await page.locator('input[name="password"], #password').first().fill(password)
  await page.locator('button[type="submit"], input[type="submit"]').first().click()
  await page.waitForLoadState('domcontentloaded').catch(() => null)
}

async function prepareMakerWorksCart(page: Page) {
  await page.addInitScript((sample) => {
    const item = {
      cartItemId: 'mw-demo-cart-item-1001',
      modelId: sample.modelId,
      title: sample.modelTitle,
      priceUsd: 42,
      size: { x: 142, y: 88, z: 38 },
      colorSlotCount: 2,
      allowedColors: ['Black', 'Blue', 'White'],
      options: {
        qty: 1,
        scale: 1,
        material: 'PLA',
        colors: ['Black', 'Translucent Blue'],
        toleranceClass: 'standard',
        finish: 'standard',
        infillPct: 25,
        productTemplateId: 'mw-demo-template-enclosure',
      },
    }
    window.localStorage.setItem('mwv2:cart', JSON.stringify([item]))
  }, SUITE_DEMO_SAMPLE)
}

async function dismissTransientOverlays(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const dismissButtons = await page.getByRole('button', { name: /^Dismiss$/ }).all()
    if (dismissButtons.length === 0) break
    for (const button of dismissButtons) {
      await button.click({ timeout: 1_000 }).catch(() => null)
    }
    await page.waitForTimeout(150)
  }
}

async function preparePageForTarget(page: Page, target: CaptureTarget) {
  if (target.app === 'MakerWorks') {
    await prepareMakerWorksCart(page)
  }
}

export function buildSyntheticPrintLabHtml(target: CaptureTarget) {
  const isDetail = target.filename.includes('detail')
  const isLibrary = target.filename.includes('library')
  const isRouting = target.filename.includes('preflight') || target.filename.includes('jobs')
  const printers = buildPrintLabPrintersFixture()
  const printerRows = printers.map((printer, index) => {
    const config = printer.config as Record<string, unknown>
    const material = String(config.demo_material || (printer.id === SUITE_DEMO_SAMPLE.printerId ? SUITE_DEMO_SAMPLE.primaryMaterial : 'PLA Basic White'))
    const queueDepth = Number(config.demo_queue_depth ?? (printer.id === SUITE_DEMO_SAMPLE.printerId ? 1 : index % 4))
    const state = String(config.demo_state || (index % 3 === 0 ? 'Ready' : index % 3 === 1 ? 'Queued' : 'Printing'))
    return { printer, material, queueDepth, state }
  })
  const fleetCards = printerRows.map(({ printer, material, queueDepth, state }) => `
    <section class="card">
      <h2>${printer.name}</h2>
      <div class="status">${state}</div>
      <p>Fixture printer profile for routing, queue depth, and loaded filament demos.</p>
      <div class="metrics">
        <div class="metric"><span>Health</span><strong>${state === 'Maintenance due' ? '72' : '100'}</strong></div>
        <div class="metric"><span>Queue</span><strong>${queueDepth}</strong></div>
        <div class="metric"><span>Material</span><strong>${material.split(' ')[0]}</strong></div>
      </div>
    </section>
  `).join('')
  const routingRows = printerRows.map(({ printer, material, queueDepth, state }, index) => `
    <tr>
      <td>${printer.name}</td>
      <td>${material}</td>
      <td>${queueDepth} jobs</td>
      <td>${index < 3 ? 'Qualified' : state === 'Maintenance due' ? 'Blocked: maintenance' : 'Approval required'}</td>
    </tr>
  `).join('')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${target.title}</title>
  <style>
    body { margin: 0; font-family: Inter, Segoe UI, Arial, sans-serif; background: #eaf4ff; color: #08213f; }
    main { max-width: 1180px; margin: 0 auto; padding: 48px; }
    .top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
    .logo { font-size: 34px; font-weight: 800; }
    .pill { border: 1px solid #9ac7f0; border-radius: 999px; padding: 8px 12px; background: #fff; font-weight: 700; color: #174a7c; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
    .card { background: #fff; border: 1px solid #c7def2; border-radius: 16px; padding: 22px; box-shadow: 0 18px 45px rgba(22, 74, 124, 0.12); }
    h1, h2, h3 { margin: 0; }
    h1 { font-size: 32px; }
    h2 { font-size: 22px; margin-bottom: 8px; }
    p { color: #385a7c; line-height: 1.5; }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px; }
    .metric { background: #eef7ff; border: 1px solid #c7def2; border-radius: 12px; padding: 12px; }
    .metric span { display: block; font-size: 12px; color: #4a6a8c; text-transform: uppercase; }
    .metric strong { display: block; margin-top: 6px; font-size: 20px; }
    .status { display: inline-block; margin: 18px 0; border-radius: 999px; background: #d7f8e8; color: #11623b; padding: 7px 10px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { text-align: left; border-bottom: 1px solid #d7e7f6; padding: 12px; }
    th { color: #42617f; font-size: 12px; text-transform: uppercase; }
  </style>
</head>
<body>
  <main>
    <div class="top">
      <div>
        <div class="logo">PrintLab</div>
        <p>Synthetic local demo view. No live printer controls or real printer private data.</p>
      </div>
      <div class="pill">${SUITE_DEMO_SAMPLE.printLabJobId}</div>
    </div>
    ${
      isLibrary
        ? `<section class="card">
            <h1>MakerWorks Library Handoff</h1>
            <p>${SUITE_DEMO_SAMPLE.modelTitle} is ready for routing with ${SUITE_DEMO_SAMPLE.primaryMaterial} and a queue-supported 3MF asset.</p>
            <table><thead><tr><th>Model</th><th>Material</th><th>Status</th><th>Estimate</th></tr></thead><tbody><tr><td>${SUITE_DEMO_SAMPLE.modelTitle}</td><td>${SUITE_DEMO_SAMPLE.primaryMaterial}</td><td>Queue ready</td><td>3h 15m</td></tr></tbody></table>
          </section>`
        : isRouting
          ? `<section class="card">
              <h1>Preflight Routing</h1>
              <p>Printer candidates are ranked for compatibility, loaded filament, health, and queue wait. This is a safe synthetic hold, not a submitted print.</p>
              <table><thead><tr><th>Printer</th><th>Filament</th><th>Queue</th><th>Decision</th></tr></thead><tbody>${routingRows}</tbody></table>
            </section>`
          : `<div class="grid">${isDetail ? fleetCards : fleetCards}</div>`
    }
  </main>
</body>
</html>`
}

async function finishTargetNavigation(page: Page, target: CaptureTarget) {
  if (target.tabTarget) {
    const tabButton = page.locator(`[data-tab-target="${target.tabTarget}"]`).first()
    if (await tabButton.count()) {
      await tabButton.click()
      await page.waitForTimeout(350)
    }
  }
  if (target.waitForText) {
    await page.getByText(target.waitForText, { exact: false }).first().waitFor({ timeout: 8_000 }).catch(() => null)
  }
}

async function captureTarget(page: Page, target: CaptureTarget, config: CaptureConfig) {
  try {
    if (target.app === 'PrintLab' && process.env.SUITE_DEMO_PRINTLAB_CAPTURE_LIVE !== '1') {
      await page.setContent(buildSyntheticPrintLabHtml(target), { waitUntil: 'domcontentloaded' })
      await page.screenshot({ path: target.outputPath, fullPage: true })
      console.log(`captured ${target.filename}`)
      return
    }
    await preparePageForTarget(page, target)
    await page.goto(target.url, { waitUntil: 'networkidle', timeout: 25_000 })
    await finishTargetNavigation(page, target)
    await dismissTransientOverlays(page)
    await page.screenshot({ path: target.outputPath, fullPage: true })
    console.log(`captured ${target.filename}`)
  } catch (error) {
    if (isOptionalCapture(target) || config.allowSkips) {
      console.log(`skipped ${target.filename}: ${error instanceof Error ? error.message : String(error)}`)
      return
    }
    throw error
  }
}

export async function runSuiteDemoScreenshotCapture(env: Env = process.env) {
  const { chromium } = await import('@playwright/test')
  const config = resolveCaptureConfig({ env })
  const targets = buildCaptureTargets(config)
  await mkdir(config.outputDir, { recursive: true })

  const requiredApps = new Set(
    targets
      .filter((target) => !isOptionalCapture(target))
      .map((target) => target.app as Exclude<SuiteDemoApp, 'Suite Flow'>),
  )
  for (const app of requiredApps) {
    const reachable = await appReachable(config.urls[app])
    if (!reachable && !config.allowSkips) {
      throw new Error(`${app} is not reachable at ${config.urls[app]}. Start local services or set SUITE_DEMO_ALLOW_SKIPS=1.`)
    }
  }

  let browser: Browser | undefined
  try {
    browser = await chromium.launch()
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await loginMakerWorks(context, config.urls.MakerWorks, env)
    const page = await context.newPage()
    await loginStockWorks(page, config.urls.StockWorks, env)
    await loginPrintLab(page, config.urls.PrintLab, env)
    for (const target of targets) {
      await captureTarget(page, target, config)
    }
  } finally {
    await browser?.close()
  }

  return { outputDir: config.outputDir, count: targets.length }
}

async function main() {
  const result = await runSuiteDemoScreenshotCapture()
  console.log(`Suite demo screenshots written to ${result.outputDir}`)
}

const isCli = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
