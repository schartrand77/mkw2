import assert from 'node:assert/strict'
import test from 'node:test'

import { buildHealthCheckUrl } from '../lib/admin/suite-connection-tests'

test('builds suite service health URLs without double slashes', () => {
  assert.equal(buildHealthCheckUrl('http://printlab:8080/'), 'http://printlab:8080/health')
  assert.equal(buildHealthCheckUrl('http://stockworks:8000'), 'http://stockworks:8000/health')
})
