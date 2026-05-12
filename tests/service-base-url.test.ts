import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeServiceBaseUrl } from '@/lib/service-base-url'

test('normalizeServiceBaseUrl preserves explicit http and trims trailing slash', () => {
  assert.equal(normalizeServiceBaseUrl('http://192.168.1.170:3777/'), 'http://192.168.1.170:3777')
})

test('normalizeServiceBaseUrl prefixes bare host and port with http', () => {
  assert.equal(normalizeServiceBaseUrl('192.168.1.170:3777'), 'http://192.168.1.170:3777')
})

test('normalizeServiceBaseUrl preserves https URLs', () => {
  assert.equal(normalizeServiceBaseUrl('https://stockworks.example.com/api/'), 'https://stockworks.example.com/api')
})

test('normalizeServiceBaseUrl can rewrite localhost for Docker container callers', () => {
  assert.equal(
    normalizeServiceBaseUrl('http://localhost:8289/', 'http://', { dockerRuntime: true }),
    'http://host.docker.internal:8289',
  )
  assert.equal(
    normalizeServiceBaseUrl('http://127.0.0.1:8289/', 'http://', { dockerRuntime: true }),
    'http://host.docker.internal:8289',
  )
  assert.equal(
    normalizeServiceBaseUrl('http://localhost:8289/', 'http://', { dockerRuntime: false }),
    'http://localhost:8289',
  )
})
