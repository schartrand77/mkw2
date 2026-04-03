const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const PART_REVIEW_RE = /^\[\[part-review:([^|\]]+)\|([^\]]+)\]\]\s*/i

async function main() {
  const comments = await prisma.modelComment.findMany({
    where: {
      partId: null,
    },
    select: {
      id: true,
      body: true,
    },
  })

  let updated = 0
  for (const comment of comments) {
    const body = typeof comment.body === 'string' ? comment.body : ''
    const match = body.match(PART_REVIEW_RE)
    if (!match) continue
    const partId = match[1]?.trim()
    const partName = match[2]?.trim()
    const cleanBody = body.replace(PART_REVIEW_RE, '').trim()
    if (!partId || !partName) continue
    await prisma.modelComment.update({
      where: { id: comment.id },
      data: {
        body: cleanBody,
        partId,
        partName,
      },
    })
    updated += 1
    console.log('Backfilled comment', comment.id, '->', partName)
  }

  console.log('Done. Updated', updated, 'comments.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
