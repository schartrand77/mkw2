import assert from 'node:assert/strict'
import test from 'node:test'
import { findImgAltViolations } from '../scripts/a11y-alt-changed'

test('a11y alt gate reports img tags without alt in changed file content', () => {
  const violations = findImgAltViolations([
    {
      path: 'components/Example.tsx',
      content: '<div><img src="/part.png" className="rounded" /></div>',
    },
  ])

  assert.equal(violations.length, 1)
  assert.equal(violations[0]?.path, 'components/Example.tsx')
})

test('a11y alt gate ignores img tags with explicit alt', () => {
  const violations = findImgAltViolations([
    {
      path: 'components/Example.tsx',
      content: '<img src="/part.png" alt="Printed part" />',
    },
  ])

  assert.deepStrictEqual(violations, [])
})
