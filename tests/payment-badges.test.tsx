import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { PaymentBadges } from '../components/PaymentBadges'

test('payment badges render at readable footer dimensions', () => {
  const html = renderToStaticMarkup(<PaymentBadges showApplePay showGooglePay />)

  assert.match(html, /src="\/ApplePay\.svg"/)
  assert.match(html, /src="\/GooglePay\.png"/)
  assert.match(html, /width="63"/)
  assert.match(html, /height="24"/)
  assert.match(html, /width="72"/)
  assert.doesNotMatch(html, /h-4/)
})
