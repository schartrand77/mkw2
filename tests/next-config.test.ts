import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

test('Next build tracing excludes local durable storage contents', async () => {
  const configModule = await import(pathToFileURL(path.join(process.cwd(), 'next.config.mjs')).href)
  const config = configModule.default

  assert.ok(config.outputFileTracingExcludes, 'outputFileTracingExcludes should be configured')
  assert.deepEqual(config.outputFileTracingExcludes['*'], ['./storage/**/*'])
})

