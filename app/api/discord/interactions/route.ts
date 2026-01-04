import { NextRequest, NextResponse } from 'next/server'
import nacl from 'tweetnacl'
import { z } from 'zod'
import { buildInviteLoginUrl, createInviteAccount } from '@/lib/invite'
import { sendDiscordDirectMessage } from '@/lib/discord'

export const dynamic = 'force-dynamic'

type DiscordOption = { name: string; value?: string | number | boolean; type?: number }

type DiscordInteraction = {
  type: number
  data?: {
    name?: string
    options?: DiscordOption[]
  }
  member?: { user?: { id?: string } }
  user?: { id?: string }
}

const optionSchema = z.object({
  name: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
})

function getOptionValue(options: DiscordOption[] | undefined, name: string) {
  if (!options?.length) return undefined
  const match = options.find((opt) => opt.name === name)
  return match?.value
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

function verifyDiscordSignature(signature: string, timestamp: string, body: string, publicKey: string) {
  try {
    const message = new TextEncoder().encode(timestamp + body)
    const sig = hexToBytes(signature)
    const key = hexToBytes(publicKey)
    return nacl.sign.detached.verify(message, sig, key)
  } catch {
    return false
  }
}

function adminAllowed(interaction: DiscordInteraction) {
  const allowed = (process.env.DISCORD_ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  if (allowed.length === 0) return true
  const userId = interaction.member?.user?.id || interaction.user?.id || ''
  return allowed.includes(userId)
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-signature-ed25519') || ''
  const timestamp = req.headers.get('x-signature-timestamp') || ''
  const publicKey = (process.env.DISCORD_PUBLIC_KEY || '').trim()
  const body = await req.text()

  if (!signature || !timestamp || !publicKey) {
    return new NextResponse('Missing Discord signature or public key', { status: 401 })
  }
  if (!verifyDiscordSignature(signature, timestamp, body, publicKey)) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  const interaction = JSON.parse(body) as DiscordInteraction

  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 })
  }

  if (interaction.type !== 2 || interaction.data?.name !== 'invite') {
    return NextResponse.json({ type: 4, data: { content: 'Unsupported command.', flags: 64 } })
  }

  if (!adminAllowed(interaction)) {
    return NextResponse.json({ type: 4, data: { content: 'Not authorized to invite users.', flags: 64 } })
  }

  let options: Array<{ name: string; value?: string | number | boolean }> = []
  try {
    options = (interaction.data?.options || []).map((opt) => optionSchema.parse(opt))
  } catch {
    return NextResponse.json({ type: 4, data: { content: 'Invalid command options.', flags: 64 } })
  }
  const email = getOptionValue(options, 'email')
  const name = getOptionValue(options, 'name')
  const targetUserId = getOptionValue(options, 'user')

  if (!email || typeof email !== 'string' || !targetUserId || typeof targetUserId !== 'string') {
    return NextResponse.json({
      type: 4,
      data: { content: 'Usage: /invite email:<email> user:<@user> name:<optional>', flags: 64 },
    })
  }

  const invitePassword = (process.env.ADMIN_INVITE_PASSWORD || '').trim()
  if (!invitePassword) {
    return NextResponse.json({ type: 4, data: { content: 'ADMIN_INVITE_PASSWORD not set.', flags: 64 } })
  }

  try {
    const { user } = await createInviteAccount({ email, name: typeof name === 'string' ? name : null, password: invitePassword })
    const { loginUrl } = buildInviteLoginUrl(user.id)
    const ttlHours = Number.parseInt(process.env.INVITE_LOGIN_TOKEN_TTL_HOURS || '24', 10)
    const ttlLabel = Number.isFinite(ttlHours) && ttlHours > 0 ? `${ttlHours} hours` : '24 hours'
    const dmBody = [
      'You have been invited to MakerWorks.',
      `Login link (expires in ${ttlLabel}): ${loginUrl}`,
      `Email: ${user.email}`,
      `Password: ${invitePassword}`,
    ].join('\n')
    const dmSent = await sendDiscordDirectMessage(targetUserId, dmBody)
    if (!dmSent) {
      return NextResponse.json({ type: 4, data: { content: 'Invite created, but DM failed to send.', flags: 64 } })
    }
    return NextResponse.json({ type: 4, data: { content: `Invite sent to <@${targetUserId}>.`, flags: 64 } })
  } catch (e: any) {
    const status = e?.status === 409 ? 'Email already registered.' : 'Failed to create invite.'
    return NextResponse.json({ type: 4, data: { content: status, flags: 64 } })
  }
}
