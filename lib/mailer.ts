import nodemailer from 'nodemailer'

type EmailPayload = {
  to: string
  subject: string
  text: string
  html?: string
}

type LoadedConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
  replyTo?: string
}

let cachedConfig: LoadedConfig | null | undefined
let transporter: nodemailer.Transporter | null = null

function resolveConfig(): LoadedConfig | null {
  if (cachedConfig !== undefined) return cachedConfig
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD
  if (!host || !port || !user || !pass) {
    cachedConfig = null
    return cachedConfig
  }
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
  const parsedPort = Number(port)
  if (!Number.isFinite(parsedPort)) {
    cachedConfig = null
    return cachedConfig
  }
  const from = process.env.RECEIPT_FROM_EMAIL || `MakerWorks <${user}>`
  const replyTo = process.env.RECEIPT_REPLY_TO_EMAIL || undefined
  cachedConfig = { host, port: parsedPort, secure, user, pass, from, replyTo }
  return cachedConfig
}

function getTransporter() {
  const config = resolveConfig()
  if (!config) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    })
  }
  return transporter
}

export function emailDeliveryEnabled() {
  return Boolean(resolveConfig())
}

export async function sendMail(payload: EmailPayload) {
  const config = resolveConfig()
  const tx = getTransporter()
  if (!config || !tx) {
    console.warn('SMTP not fully configured; skipping email send:', payload.subject)
    return false
  }
  await tx.sendMail({
    from: config.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    replyTo: config.replyTo,
  })
  return true
}
