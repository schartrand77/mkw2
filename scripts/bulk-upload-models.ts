import 'dotenv/config'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

type Options = {
  dir: string
  baseUrl: string
  email: string
  password: string
  material: string
  tags: string
  creditName?: string
  creditUrl?: string
  description?: string
  dryRun: boolean
  limit?: number
  matchCoverImages: boolean
}

type UploadTarget = {
  modelPath: string
  relativePath: string
  title: string
  coverPath?: string
}

const MODEL_EXTENSIONS = new Set(['.stl', '.obj', '.3mf', '.zip'])
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic'])

function usage() {
  console.log([
    'Usage: npm run bulk:upload-models -- --dir <folder> --base-url <url> --email <email> --password <password> [options]',
    '',
    'Options:',
    '  --material <name>         Material to assign to every upload (default: PLA)',
    '  --tags <csv>              Comma-separated tags applied to every upload',
    '  --credit-name <name>      Optional credit creator name',
    '  --credit-url <url>        Optional credit creator URL',
    '  --description <text>      Optional description applied to every upload',
    '  --limit <n>               Only upload the first n discovered files',
    '  --dry-run                 List files without uploading',
    '  --no-cover-match          Disable matching cover images by basename',
    '',
    'Env fallbacks:',
    '  BULK_UPLOAD_DIR, BULK_UPLOAD_BASE_URL, BULK_UPLOAD_EMAIL, BULK_UPLOAD_PASSWORD,',
    '  BULK_UPLOAD_MATERIAL, BULK_UPLOAD_TAGS, BULK_UPLOAD_CREDIT_NAME, BULK_UPLOAD_CREDIT_URL,',
    '  BULK_UPLOAD_DESCRIPTION, BULK_UPLOAD_LIMIT, BULK_UPLOAD_DRY_RUN, BULK_UPLOAD_MATCH_COVER',
  ].join('\n'))
}

function parseArgs(argv: string[]): Options {
  const argMap = new Map<string, string>()
  let dryRun = false
  let matchCoverImages = true
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i]
    if (!raw.startsWith('--')) continue
    if (raw === '--dry-run') {
      dryRun = true
      continue
    }
    if (raw === '--no-cover-match') {
      matchCoverImages = false
      continue
    }
    const key = raw.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }
    argMap.set(key, value)
    i += 1
  }

  const dir = argMap.get('dir') || process.env.BULK_UPLOAD_DIR || ''
  const baseUrl = (argMap.get('base-url') || process.env.BULK_UPLOAD_BASE_URL || 'http://127.0.0.1:3000').trim()
  const email = (argMap.get('email') || process.env.BULK_UPLOAD_EMAIL || process.env.ADMIN_EMAIL || '').trim()
  const password = (argMap.get('password') || process.env.BULK_UPLOAD_PASSWORD || process.env.ADMIN_PASSWORD || '').trim()
  const material = (argMap.get('material') || process.env.BULK_UPLOAD_MATERIAL || 'PLA').trim() || 'PLA'
  const tags = (argMap.get('tags') || process.env.BULK_UPLOAD_TAGS || '').trim()
  const creditName = (argMap.get('credit-name') || process.env.BULK_UPLOAD_CREDIT_NAME || '').trim() || undefined
  const creditUrl = (argMap.get('credit-url') || process.env.BULK_UPLOAD_CREDIT_URL || '').trim() || undefined
  const description = (argMap.get('description') || process.env.BULK_UPLOAD_DESCRIPTION || '').trim() || undefined
  const limitRaw = argMap.get('limit') || process.env.BULK_UPLOAD_LIMIT || ''
  const limit = limitRaw ? Number(limitRaw) : undefined
  const envDryRun = /^(1|true|yes)$/i.test(process.env.BULK_UPLOAD_DRY_RUN || '')
  const envMatchCover = !/^(0|false|no)$/i.test(process.env.BULK_UPLOAD_MATCH_COVER || 'true')

  if (!dir) throw new Error('Missing upload folder. Pass --dir or set BULK_UPLOAD_DIR.')
  if (!baseUrl) throw new Error('Missing base URL. Pass --base-url or set BULK_UPLOAD_BASE_URL.')
  if (!email) throw new Error('Missing login email. Pass --email or set BULK_UPLOAD_EMAIL/ADMIN_EMAIL.')
  if (!password) throw new Error('Missing login password. Pass --password or set BULK_UPLOAD_PASSWORD/ADMIN_PASSWORD.')

  return {
    dir: path.resolve(dir),
    baseUrl: baseUrl.replace(/\/+$/, ''),
    email,
    password,
    material,
    tags,
    creditName,
    creditUrl,
    description,
    dryRun: dryRun || envDryRun,
    limit: Number.isFinite(limit) && limit && limit > 0 ? Math.floor(limit) : undefined,
    matchCoverImages: matchCoverImages && envMatchCover,
  }
}

function parseSetCookies(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const raw = typeof getSetCookie === 'function'
    ? getSetCookie.call(headers)
    : headers.get('set-cookie')
      ? [headers.get('set-cookie') as string]
      : []
  return raw
    .map((entry) => entry.split(';')[0]?.trim() || '')
    .filter(Boolean)
}

function mergeCookies(...groups: string[][]) {
  const map = new Map<string, string>()
  for (const group of groups) {
    for (const pair of group) {
      const idx = pair.indexOf('=')
      if (idx <= 0) continue
      map.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
    }
  }
  return Array.from(map.entries()).map(([key, value]) => `${key}=${value}`).join('; ')
}

function titleFromFilename(filename: string) {
  const base = path.basename(filename, path.extname(filename))
  return base
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function walkModels(rootDir: string) {
  const output: string[] = []
  async function visit(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await visit(full)
        continue
      }
      const ext = path.extname(entry.name).toLowerCase()
      if (MODEL_EXTENSIONS.has(ext)) {
        output.push(full)
      }
    }
  }
  await visit(rootDir)
  output.sort((a, b) => a.localeCompare(b))
  return output
}

async function findMatchingCover(modelPath: string) {
  const dir = path.dirname(modelPath)
  const base = path.basename(modelPath, path.extname(modelPath)).toLowerCase()
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (!IMAGE_EXTENSIONS.has(ext)) continue
    const entryBase = path.basename(entry.name, ext).toLowerCase()
    if (entryBase === base || entryBase === `${base}-cover` || entryBase === `${base}_cover`) {
      return path.join(dir, entry.name)
    }
  }
  return undefined
}

async function buildTargets(opts: Options) {
  const modelPaths = await walkModels(opts.dir)
  const selected = opts.limit ? modelPaths.slice(0, opts.limit) : modelPaths
  const targets: UploadTarget[] = []
  for (const modelPath of selected) {
    const relativePath = path.relative(opts.dir, modelPath)
    const title = titleFromFilename(modelPath)
    const coverPath = opts.matchCoverImages ? await findMatchingCover(modelPath) : undefined
    targets.push({ modelPath, relativePath, title, coverPath })
  }
  return targets
}

async function login(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error || `Login failed (${response.status})`)
  }
  const cookies = parseSetCookies(response.headers)
  const cookieHeader = mergeCookies(cookies)
  if (!cookieHeader) throw new Error('Login succeeded but no auth cookie was returned.')
  return cookieHeader
}

async function uploadFile(opts: Options, cookieHeader: string, target: UploadTarget) {
  const fileBuffer = await readFile(target.modelPath)
  const form = new FormData()
  form.set('title', target.title)
  form.set('description', opts.description || '')
  form.set('material', opts.material)
  form.set('tags', opts.tags)
  if (opts.creditName) form.set('creditName', opts.creditName)
  if (opts.creditUrl) form.set('creditUrl', opts.creditUrl)
  form.append('files', new File([fileBuffer], path.basename(target.modelPath)))

  if (target.coverPath) {
    const imageBuffer = await readFile(target.coverPath)
    form.set('image', new File([imageBuffer], path.basename(target.coverPath)))
  }

  const response = await fetch(`${opts.baseUrl}/api/upload`, {
    method: 'POST',
    headers: {
      'cookie': cookieHeader,
      'accept': 'application/json',
    },
    body: form,
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error || `Upload failed (${response.status})`)
  }
  return body?.model
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage()
    return
  }

  const opts = parseArgs(process.argv.slice(2))
  const dirStat = await stat(opts.dir).catch(() => null)
  if (!dirStat?.isDirectory()) {
    throw new Error(`Upload folder does not exist or is not a directory: ${opts.dir}`)
  }

  const targets = await buildTargets(opts)
  if (targets.length === 0) {
    console.log(`No supported model files found under ${opts.dir}`)
    return
  }

  console.log(`Discovered ${targets.length} model file(s) under ${opts.dir}`)
  for (const target of targets) {
    console.log(`- ${target.relativePath}${target.coverPath ? ` [cover: ${path.basename(target.coverPath)}]` : ''}`)
  }
  if (opts.dryRun) {
    console.log('Dry run enabled. No files were uploaded.')
    return
  }

  const cookieHeader = await login(opts.baseUrl, opts.email, opts.password)
  let uploaded = 0
  let failed = 0
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i]
    const indexLabel = `[${i + 1}/${targets.length}]`
    try {
      console.log(`${indexLabel} Uploading ${target.relativePath}`)
      const model = await uploadFile(opts, cookieHeader, target)
      uploaded += 1
      console.log(`${indexLabel} Uploaded -> ${model?.id || 'unknown-id'} (${target.title})`)
    } catch (err) {
      failed += 1
      const message = err instanceof Error ? err.message : String(err)
      console.error(`${indexLabel} Failed ${target.relativePath}: ${message}`)
    }
  }

  console.log(`Finished. Uploaded: ${uploaded}. Failed: ${failed}.`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
