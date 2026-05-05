import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { prisma } from '../lib/db'

test('model thumbs endpoint returns public model thumbnail summaries', async () => {
  const { GET } = await import('../app/api/models/thumbs/route')
  const originalFindMany = (prisma.model as any).findMany
  let findManyArgs: any = null

  ;(prisma.model as any).findMany = async (args: any) => {
    findManyArgs = args
    return [
      {
        id: 'mw-demo-parametric-enclosure',
        title: 'Parametric Enclosure Kit',
        coverImagePath: '/demo/suite/thumbnail.webp',
      },
    ]
  }

  try {
    const req = new NextRequest('http://localhost/api/models/thumbs?q=enclosure&pageSize=10')
    const res = await GET(req)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), {
      models: [
        {
          id: 'mw-demo-parametric-enclosure',
          title: 'Parametric Enclosure Kit',
          coverImagePath: '/demo/suite/thumbnail.webp',
        },
      ],
    })
    assert.deepEqual(findManyArgs, {
      where: {
        visibility: 'public',
        OR: [
          { title: { contains: 'enclosure', mode: 'insensitive' } },
          { description: { contains: 'enclosure', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 10,
      select: { id: true, title: true, coverImagePath: true },
    })
  } finally {
    ;(prisma.model as any).findMany = originalFindMany
  }
})
