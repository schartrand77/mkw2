import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

type ChangedFile = {
  path: string
  content: string
}

type AltViolation = {
  path: string
  line: number
  snippet: string
}

const CHECKED_EXTENSIONS = new Set(['.tsx', '.jsx', '.html'])

function extensionOf(filePath: string) {
  const match = filePath.match(/\.[^.]+$/)
  return match?.[0] ?? ''
}

function isCheckedFile(filePath: string) {
  return CHECKED_EXTENSIONS.has(extensionOf(filePath))
}

function lineForIndex(content: string, index: number) {
  return content.slice(0, index).split(/\r?\n/).length
}

export function findImgAltViolations(files: ChangedFile[]): AltViolation[] {
  const violations: AltViolation[] = []
  for (const file of files) {
    if (!isCheckedFile(file.path)) continue
    const matches = file.content.matchAll(/<img\b[^>]*>/gi)
    for (const match of matches) {
      const tag = match[0]
      if (/\salt\s*=/i.test(tag)) continue
      violations.push({
        path: file.path,
        line: lineForIndex(file.content, match.index ?? 0),
        snippet: tag.replace(/\s+/g, ' ').slice(0, 160),
      })
    }
  }
  return violations
}

function git(args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

function changedPathsFromGit() {
  const base = process.env.A11Y_BASE_REF || 'origin/main'
  const attempts = [
    ['diff', '--name-only', '--diff-filter=ACMRTUXB', `${base}...HEAD`],
    ['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD~1..HEAD'],
    ['diff', '--name-only', '--diff-filter=ACMRTUXB'],
  ]
  for (const args of attempts) {
    try {
      const output = git(args)
      if (output) return output.split(/\r?\n/)
    } catch {
      // Try the next local diff strategy.
    }
  }
  return []
}

export function readChangedFiles(paths: string[]): ChangedFile[] {
  return paths
    .filter((filePath) => isCheckedFile(filePath) && existsSync(filePath))
    .map((filePath) => ({ path: filePath, content: readFileSync(filePath, 'utf8') }))
}

if (require.main === module) {
  const explicitPaths = process.argv.slice(2)
  const paths = explicitPaths.length > 0 ? explicitPaths : changedPathsFromGit()
  const violations = findImgAltViolations(readChangedFiles(paths))
  if (violations.length > 0) {
    console.error('Missing img alt text in changed files:')
    for (const violation of violations) {
      console.error(`${violation.path}:${violation.line} ${violation.snippet}`)
    }
    process.exit(1)
  }
}
