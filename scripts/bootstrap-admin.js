/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME || 'Admin'

  if (!email || !password) {
    console.log('ADMIN_EMAIL or ADMIN_PASSWORD not set; skipping admin bootstrap.')
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
