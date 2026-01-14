import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { DEFAULT_ACHIEVEMENTS, ensureDefaultAchievements } from '../lib/achievements'

type Change = { key: string; before: { name: string | null; icon: string | null }; after: { name: string; icon: string | null } }

const prisma = new PrismaClient()

function stripPrefixIfPresent(name: string, icon?: string | null) {
  if (!icon) return name
  const prefix = `${icon} `
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

async function run() {
  await ensureDefaultAchievements(prisma)

  const changes: Change[] = []
  for (const def of DEFAULT_ACHIEVEMENTS) {
    const ach = await prisma.achievement.findUnique({ where: { key: def.key } })
    if (!ach) continue

    const desiredName = def.name
    const desiredIcon = def.icon ?? null
    const cleanedName = stripPrefixIfPresent(ach.name, desiredIcon)

    const nextName = cleanedName !== desiredName ? desiredName : ach.name
    const nextIcon = ach.icon || desiredIcon

    if (nextName !== ach.name || nextIcon !== ach.icon) {
      changes.push({
        key: def.key,
        before: { name: ach.name, icon: ach.icon },
        after: { name: nextName, icon: nextIcon },
      })
      await prisma.achievement.update({
        where: { key: def.key },
        data: {
          name: nextName,
          icon: nextIcon,
        },
      })
    }
  }

  console.log(`Updated ${changes.length} achievements.`)
  if (changes.length > 0) {
    for (const change of changes) {
      console.log(
        `${change.key}: "${change.before.name}" (${change.before.icon ?? 'null'}) -> "${change.after.name}" (${change.after.icon ?? 'null'})`
      )
    }
  }
}

run()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
