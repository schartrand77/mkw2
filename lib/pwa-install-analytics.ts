export type PwaInstallAnalyticsEvent = 'accepted' | 'dismissed' | 'ios_instruction_shown'

export type PwaInstallAnalyticsPayload = {
  event: PwaInstallAnalyticsEvent
  platform: string
  source: string
}

export function buildPwaInstallAnalyticsPayload(
  event: PwaInstallAnalyticsEvent,
  details: { platform?: string | null; source?: string | null } = {},
): PwaInstallAnalyticsPayload {
  return {
    event,
    platform: details.platform?.trim() || 'unknown',
    source: details.source?.trim() || 'pwa-install-prompt',
  }
}

export function trackPwaInstallEvent(
  event: PwaInstallAnalyticsEvent,
  details: { platform?: string | null; source?: string | null } = {},
) {
  if (typeof window === 'undefined') return
  const payload = buildPwaInstallAnalyticsPayload(event, details)
  const body = JSON.stringify(payload)
  const url = '/api/analytics/pwa-install'
  try {
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      if (sent) return
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Analytics must never block install UX.
  }
}
