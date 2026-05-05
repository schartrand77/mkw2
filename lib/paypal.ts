import type { Currency } from '@/lib/currency'

type FetchLike = typeof fetch

type PayPalOrderResponse = {
  id: string
  status?: string
}

type PayPalCaptureResponse = {
  id: string
  status?: string
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id?: string
        status?: string
        amount?: {
          currency_code?: string
          value?: string
        }
      }>
    }
  }>
}

export type CreatePayPalOrderParams = {
  amountCents: number
  currency: Currency | string
  checkoutId: string
  accessToken?: string
  fetchImpl?: FetchLike
}

export type CapturePayPalOrderParams = {
  orderId: string
  expectedAmountCents: number
  expectedCurrency: Currency | string
  accessToken?: string
  fetchImpl?: FetchLike
}

function getPayPalBaseUrl() {
  const explicit = process.env.PAYPAL_API_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  return (process.env.PAYPAL_ENVIRONMENT || process.env.PAYPAL_ENV || '').trim().toLowerCase() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

function formatPayPalAmount(amountCents: number) {
  if (!Number.isFinite(amountCents) || amountCents < 0) throw new Error('PayPal amount must be non-negative')
  return (Math.round(amountCents) / 100).toFixed(2)
}

function normalizeCurrencyCode(currency: Currency | string) {
  const code = String(currency || '').trim().toUpperCase()
  if (!code) throw new Error('PayPal currency is required')
  return code
}

async function getPayPalAccessToken(fetchImpl: FetchLike) {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim()
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) throw new Error('PayPal is not configured')

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetchImpl(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const body = await res.json().catch(() => null) as { access_token?: string, error_description?: string } | null
  if (!res.ok || !body?.access_token) {
    throw new Error(body?.error_description || 'Unable to authenticate with PayPal')
  }
  return body.access_token
}

async function resolveAccessToken(accessToken: string | undefined, fetchImpl: FetchLike) {
  return accessToken || getPayPalAccessToken(fetchImpl)
}

export async function createPayPalOrder(params: CreatePayPalOrderParams) {
  const fetchImpl = params.fetchImpl || fetch
  const accessToken = await resolveAccessToken(params.accessToken, fetchImpl)
  const currency = normalizeCurrencyCode(params.currency)
  const amount = formatPayPalAmount(params.amountCents)
  const res = await fetchImpl(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.checkoutId,
          amount: {
            currency_code: currency,
            value: amount,
          },
        },
      ],
    }),
  })
  const body = await res.json().catch(() => null) as PayPalOrderResponse | null
  if (!res.ok || !body?.id) throw new Error(`Unable to create PayPal order (${res.status})`)
  return body
}

export async function capturePayPalOrder(params: CapturePayPalOrderParams) {
  const fetchImpl = params.fetchImpl || fetch
  const accessToken = await resolveAccessToken(params.accessToken, fetchImpl)
  const expectedCurrency = normalizeCurrencyCode(params.expectedCurrency)
  const expectedAmount = formatPayPalAmount(params.expectedAmountCents)
  const orderId = params.orderId.trim()
  if (!orderId) throw new Error('PayPal order id is required')

  const res = await fetchImpl(`${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  const body = await res.json().catch(() => null) as PayPalCaptureResponse | null
  if (!res.ok || !body?.id) throw new Error(`Unable to capture PayPal order (${res.status})`)

  const captures = body.purchase_units?.flatMap((unit) => unit.payments?.captures || []) || []
  const completedCapture = captures.find((capture) => String(capture.status || '').toUpperCase() === 'COMPLETED') || captures[0]
  const captureAmount = completedCapture?.amount
  if (!completedCapture?.id || !captureAmount) throw new Error('PayPal capture response is missing payment details')
  if (String(captureAmount.currency_code || '').toUpperCase() !== expectedCurrency) {
    throw new Error('PayPal capture currency does not match checkout currency')
  }
  if (Number(captureAmount.value).toFixed(2) !== expectedAmount) {
    throw new Error('PayPal capture amount does not match checkout amount')
  }

  return {
    orderId: body.id,
    captureId: completedCapture.id,
    status: body.status || completedCapture.status || null,
    paymentStatus: String(completedCapture.status || '').toUpperCase() === 'COMPLETED' ? 'paid' : 'processing',
  }
}
