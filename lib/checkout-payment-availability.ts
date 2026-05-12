type PaymentEnv = Record<string, string | undefined>

export type CheckoutPanelPromptInput = {
  hasCartItems: boolean
  hasIntent: boolean
  loading: boolean
  hasSuccessIntent: boolean
  hasConfirmation: boolean
  error?: string | null
}

export function resolvePublicPaymentConfig(env: PaymentEnv = process.env) {
  const stripePublishableKey = firstEnvValue(env, ['STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'])
  const stripeSecretKey = firstEnvValue(env, ['STRIPE_SECRET_KEY'])
  const paypalClientId = firstEnvValue(env, ['NEXT_PUBLIC_PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_ID'])
  const paypalClientSecret = firstEnvValue(env, ['PAYPAL_CLIENT_SECRET'])

  return {
    stripePublishableKey: stripePublishableKey && stripeSecretKey ? stripePublishableKey : '',
    paypalClientId: paypalClientId && paypalClientSecret ? paypalClientId : '',
  }
}

export function resolveCheckoutPanelPrompt(input: CheckoutPanelPromptInput) {
  if (input.hasIntent || input.loading || input.hasSuccessIntent || input.hasConfirmation) return null
  if (!input.hasCartItems) return 'Add items to your cart to start checkout.'
  if (input.error) return 'Resolve the checkout issue before continuing.'
  return 'Preparing checkout totals and payment options.'
}

function firstEnvValue(env: PaymentEnv, names: string[]) {
  for (const name of names) {
    const value = env[name]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

