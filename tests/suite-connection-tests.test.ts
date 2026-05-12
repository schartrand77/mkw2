import assert from 'node:assert/strict'
import test from 'node:test'

import { buildConnectionTestUrl, buildHealthCheckUrl } from '../lib/admin/suite-connection-tests'

test('builds suite service health URLs without double slashes', () => {
  assert.equal(buildHealthCheckUrl('http://printlab:8080/'), 'http://printlab:8080/health')
  assert.equal(buildHealthCheckUrl('http://stockworks:8000'), 'http://stockworks:8000/health')
})

test('rewrites local host service URLs when MakerWorks runs in Docker', () => {
  assert.equal(
    buildConnectionTestUrl('http://localhost:8289', { dockerRuntime: true }),
    'http://host.docker.internal:8289/health',
  )
  assert.equal(
    buildConnectionTestUrl('http://127.0.0.1:8289/', { dockerRuntime: true }),
    'http://host.docker.internal:8289/health',
  )
  assert.equal(
    buildConnectionTestUrl('http://localhost:8289', { dockerRuntime: false }),
    'http://localhost:8289/health',
  )
})
