import QRCode from 'qrcode'

const DEFAULT_OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 1,
  width: 256,
}

export async function generateQrDataUrl(text: string, options: Partial<typeof DEFAULT_OPTIONS> = {}) {
  const payload = text.trim()
  if (!payload) throw new Error('QR payload is empty')
  return QRCode.toDataURL(payload, { ...DEFAULT_OPTIONS, ...options })
}
