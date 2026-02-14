export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/db'
import FeaturedManager from '@/components/admin/FeaturedManager'
import FeaturedMarquee from '@/components/FeaturedMarquee'

export default async function AdminFeaturedPage() {
  const featuredItems = await prisma.featuredModel.findMany({
    include: {
      model: {
        select: {
          id: true,
          title: true,
          coverImagePath: true,
          visibility: true,
          priceUsd: true,
          salePriceIsFrom: true,
          salePriceUnit: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  })

  const initialFeatured = featuredItems.map((item) => item.model)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Featured models</h1>
        <p className="mt-1 text-sm text-slate-400">Control homepage featured placement.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
        {initialFeatured.length > 0 ? <FeaturedMarquee models={initialFeatured} variant="compact" /> : <p className="text-sm text-slate-400">No featured models selected.</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
        <FeaturedManager initial={initialFeatured} />
      </div>
    </div>
  )
}
