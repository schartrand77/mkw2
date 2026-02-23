/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const WEAK_DEFAULT_VALUES = new Set([
  '',
  'changeme',
  'change-me',
  'change-me-please',
  'password',
  'password123',
  'admin',
  'admin123',
  'default',
  'secret',
  'test',
  'dev',
])

function validateAdminPassword(password) {
  const normalized = (password || '').trim()
  if (!normalized) return { ok: false, message: 'ADMIN_PASSWORD is not set.' }
  if (normalized.length < 12) return { ok: false, message: 'ADMIN_PASSWORD must be at least 12 characters.' }
  if (WEAK_DEFAULT_VALUES.has(normalized.toLowerCase())) {
    return { ok: false, message: 'ADMIN_PASSWORD uses a weak/default value.' }
  }
  return { ok: true }
}

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME || 'Admin'

  if (!email || !password) {
    console.log('ADMIN_EMAIL or ADMIN_PASSWORD not set; skipping admin bootstrap.')
    return
  }
  const passwordValidation = validateAdminPassword(password)
  if (!passwordValidation.ok) {
    const msg = passwordValidation.message || 'Invalid ADMIN_PASSWORD.'
    if (process.env.NODE_ENV === 'production') {
      console.error(`Refusing admin bootstrap in production: ${msg}`)
      process.exitCode = 1
      return
    }
    console.warn(`Skipping admin bootstrap: ${msg}`)
    return
  }

  const prisma = new PrismaClient()
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, name, isAdmin: true, emailVerified: true, isSuspended: false },
      create: { email, name, passwordHash, isAdmin: true, emailVerified: true, isSuspended: false },
    })
    console.log(`Admin ensured: ${user.email} (isAdmin=${user.isAdmin})`)
  } catch (err) {
    console.error('Failed to bootstrap admin user:', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
