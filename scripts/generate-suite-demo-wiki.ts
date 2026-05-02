import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { buildSuiteDemoWiki } from '@/lib/suite-demo/wiki'

export async function generateSuiteDemoWiki(root = process.cwd()) {
  const outputPath = path.join(root, 'docs', 'wiki', 'Suite-Demo-Walkthrough.md')
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, buildSuiteDemoWiki(), 'utf-8')
  return outputPath
}

async function main() {
  const outputPath = await generateSuiteDemoWiki()
  console.log(`Suite demo wiki written to ${outputPath}`)
}

const isCli = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
