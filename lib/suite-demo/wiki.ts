import { screenshotsByApp, SUITE_DEMO_ASSET_DIR, SUITE_DEMO_SAMPLE } from './manifest'

function imagePath(filename: string) {
  return `${SUITE_DEMO_ASSET_DIR.replace(/^docs\/wiki\//, '')}/${filename}`
}

export function buildSuiteDemoWiki() {
  const groups = screenshotsByApp()
  const lines: string[] = [
    '# MakerWorks Suite Demo Walkthrough',
    '',
    'This page documents a fully synthetic end-to-end MakerWorks suite scenario. It is designed for local screenshots and onboarding, not production operations.',
    '',
    '## Demo Story',
    '',
    `A synthetic customer, ${SUITE_DEMO_SAMPLE.customerName}, orders the ${SUITE_DEMO_SAMPLE.modelTitle} for ${SUITE_DEMO_SAMPLE.organizationName}. MakerWorks handles discovery, quoting, checkout, and admin production views. PrintLab shows the safe fake printer handoff for ${SUITE_DEMO_SAMPLE.printLabJobId}. StockWorks shows material availability, stock movements, incoming job demand, and loaded tray context.`,
    '',
    'Demo identifiers:',
    '',
    `- Order: ${SUITE_DEMO_SAMPLE.orderLabel}`,
    `- PrintLab job: ${SUITE_DEMO_SAMPLE.printLabJobId}`,
    `- Printer: ${SUITE_DEMO_SAMPLE.printerName}`,
    `- Material: ${SUITE_DEMO_SAMPLE.primaryMaterial}`,
    '',
    '## Safety',
    '',
    'The demo workflow uses synthetic data only. It must not capture real customer records, real inventory counts, `.env` values, payment secrets, or production URLs.',
    '',
    'The PrintLab portion is fixture-based and does not send real printer actions. Do not use this workflow to pause, resume, stop, heat, move fans, upload, or submit real print jobs.',
    '',
    'By default, PrintLab screenshots are rendered from synthetic demo content so live printer serials, names, camera views, and job state are not captured. Set `SUITE_DEMO_PRINTLAB_CAPTURE_LIVE=1` only when you explicitly want to document a safe non-production PrintLab instance.',
    '',
    '## Regenerating',
    '',
    'Run these commands from the MakerWorks repo root after local demo services are available:',
    '',
    '```powershell',
    'npm run suite:demo:seed',
    'npm run suite:demo:screenshots',
    'npm run suite:demo:wiki',
    '```',
    '',
    'Screenshots are written under `docs/wiki/assets/suite-screenshots/`.',
    '',
  ]

  for (const [app, entries] of Object.entries(groups)) {
    if (!entries.length) continue
    lines.push(`## ${app}`, '')
    for (const entry of entries) {
      lines.push(`### ${entry.title}`, '', entry.description, '', `![${entry.title}](${imagePath(entry.filename)})`, '')
    }
  }

  lines.push(
    '## Integration Flow',
    '',
    '1. MakerWorks owns the storefront, quoting, checkout, order lifecycle, and admin production view.',
    '2. StockWorks owns materials, inventory, merch, stock movements, material warnings, and incoming job demand.',
    '3. PrintLab owns printer state, preflight/routing, submitted jobs, successful G-code records, and callback context.',
    '4. The synthetic order ties the same sample material, printer, and job identifiers across all three apps.',
    '',
  )

  return `${lines.join('\n').trimEnd()}\n`
}
