import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import FeasibilityScorecard from '../components/FeasibilityScorecard'

test('formats feasibility signal values so long decimals do not overflow metric tiles', () => {
  const html = renderToStaticMarkup(
    <FeasibilityScorecard
      scorecard={{
        score: 54,
        tier: 'High Attention',
        summary: 'Needs review.',
        signals: [
          { label: 'Support', value: 34.80475382003395, summary: 'Higher means less support cleanup.' },
        ],
      }}
    />,
  )

  assert.match(html, />35</)
  assert.doesNotMatch(html, /34\.80475382003395/)
})

