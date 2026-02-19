export type ProcessingBrokerConnection = {
  url: string
  maxRetriesPerRequest: null
  enableReadyCheck: false
}

export function getProcessingBrokerUrl() {
  const raw = process.env.REDIS_URL || process.env.BULLMQ_REDIS_URL || ''
  return raw.trim() || null
}

export function processingBrokerEnabled() {
  return Boolean(getProcessingBrokerUrl())
}

export function getProcessingBrokerConnection() {
  const url = getProcessingBrokerUrl()
  if (!url) return null
  return {
    url,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  } satisfies ProcessingBrokerConnection
}
