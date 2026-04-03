import { sendMail } from './mailer'
import { BRAND_NAME } from './brand'

type InviteEmailOptions = {
  userName?: string | null
  password?: string | null
}

function getInviteTtlHours() {
  const hours = Number.parseInt(process.env.INVITE_LOGIN_TOKEN_TTL_HOURS || '24', 10)
  return Number.isFinite(hours) && hours > 0 ? hours : 24
}

export async function sendInviteEmail(to: string, loginUrl: string, opts?: InviteEmailOptions) {
  const ttlHours = getInviteTtlHours()
  const greeting = opts?.userName ? `Hi ${opts.userName},` : 'Hi there,'
  const passwordBlock = opts?.password
    ? `\n\nPrefer a password? You can sign in with:\nEmail: ${to}\nPassword: ${opts.password}`
    : ''
  const subject = `You're invited to ${BRAND_NAME}`
  const text = `${greeting}

You've been invited to ${BRAND_NAME}. Use the link below to sign in:

${loginUrl}

This link expires in ${ttlHours} hour${ttlHours === 1 ? '' : 's'}.
${passwordBlock}
`

  const htmlPassword = opts?.password
    ? `<p style="margin:12px 0 0 0;">Prefer a password? You can sign in with:</p>
<p style="margin:4px 0 0 0;"><strong>Email:</strong> ${to}<br/><strong>Password:</strong> ${opts.password}</p>`
    : ''
  const html = `<p>${greeting}</p>
<p>You've been invited to ${BRAND_NAME}. Use the link below to sign in:</p>
<p><a href="${loginUrl}" style="color:#0ea5e9; text-decoration:underline;">Accept invite</a></p>
<p style="color:#64748b;font-size:12px;">This link expires in ${ttlHours} hour${ttlHours === 1 ? '' : 's'}.</p>
<p style="color:#64748b;font-size:12px;">If the button does not work, copy and paste this link into your browser:<br/>${loginUrl}</p>
${htmlPassword}`

  return sendMail({ to, subject, text, html })
}
