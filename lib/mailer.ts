import nodemailer from 'nodemailer'
import { BRAND_NAME } from './brand'

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
let processEnvSnapshot: Record<string, string | undefined> | null = null

function resolveConfig(): LoadedConfig | null {
  if (processEnvSnapshot) {
    const identical =
      processEnvSnapshot.SMTP_HOST === process.env.SMTP_HOST &&
      processEnvSnapshot.SMTP_PORT === process.env.SMTP_PORT &&
      processEnvSnapshot.SMTP_USER === process.env.SMTP_USER &&
      processEnvSnapshot.SMTP_PASSWORD === process.env.SMTP_PASSWORD &&
      processEnvSnapshot.SMTP_SECURE === process.env.SMTP_SECURE &&
      processEnvSnapshot.RECEIPT_FROM_EMAIL === process.env.RECEIPT_FROM_EMAIL &&
      processEnvSnapshot.RECEIPT_REPLY_TO_EMAIL === process.env.RECEIPT_REPLY_TO_EMAIL
    if (!identical) {
      cachedConfig = undefined
      transporter = null
    }
  }

  if (cachedConfig !== undefined) return cachedConfig
  processEnvSnapshot = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_SECURE: process.env.SMTP_SECURE,
    RECEIPT_FROM_EMAIL: process.env.RECEIPT_FROM_EMAIL,
    RECEIPT_REPLY_TO_EMAIL: process.env.RECEIPT_REPLY_TO_EMAIL,
  }
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD
  if (!host || !port || !user || !pass) {
    console.warn('SMTP configuration missing', {
      hostSet: Boolean(host),
      portSet: Boolean(port),
      userSet: Boolean(user),
      passSet: Boolean(pass),
    })
    cachedConfig = null
    return cachedConfig
  }
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
  const parsedPort = Number(port)
  if (!Number.isFinite(parsedPort)) {
    console.warn('SMTP configuration invalid port value', { port })
    cachedConfig = null
    return cachedConfig
  }
  const from = process.env.RECEIPT_FROM_EMAIL || `${BRAND_NAME} <${user}>`
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
        type: process.env.SMTP_AUTH_TYPE as any,
      },
      authMethod: process.env.SMTP_AUTH_METHOD,
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
