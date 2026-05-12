import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPrintLabHealthRequestInit } from '../lib/observability-health'

test('PrintLab health check sends configured auth headers', async () => {
  const previousAuth = process.env.PRINTLAB_AUTH_HEADER
  const previousCookie = process.env.PRINTLAB_SESSION_COOKIE
  const previousKey = process.env.PRINTLAB_API_KEY
  try {
    process.env.PRINTLAB_AUTH_HEADER = 'Basic example'
    process.env.PRINTLAB_SESSION_COOKIE = 'session=abc'
    process.env.PRINTLAB_API_KEY = 'api-key'
    const init = await buildPrintLabHealthRequestInit()
    const headers = init?.headers as Record<string, string>
    assert.equal(headers.Authorization, 'Basic example')
    assert.equal(headers.Cookie, 'session=abc')
    assert.equal(headers['X-API-Key'], 'api-key')
  } finally {
    if (previousAuth === undefined) delete process.env.PRINTLAB_AUTH_HEADER
    else process.env.PRINTLAB_AUTH_HEADER = previousAuth
    if (previousCookie === undefined) delete process.env.PRINTLAB_SESSION_COOKIE
    else process.env.PRINTLAB_SESSION_COOKIE = previousCookie
    if (previousKey === undefined) delete process.env.PRINTLAB_API_KEY
    else process.env.PRINTLAB_API_KEY = previousKey
  }
})
