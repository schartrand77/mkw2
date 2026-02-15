import Link from 'next/link'
import { prisma } from '@/lib/db'
import { buildImageSrc } from '@/lib/storage'
import { formatCurrency } from '@/lib/currency'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const products = await prisma.productTemplate.findMany({
    where: {
      isActive: true,
      OR: [
        { baseModelId: null },
        { baseModel: { is: { visibility: 'public' } } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      baseModel: {
        select: {
          id: true,
          title: true,
          priceUsd: true,
          material: true,
          flatRatePricing: true,
          visibility: true,
          coverImagePath: true,
          updatedAt: true,
        },
      },
    },
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">Products</h1>
        <p className="text-sm text-slate-400">Configure materials, sizes, and finishes before adding to cart.</p>
      </div>
      {products.length === 0 ? (
        <div className="glass rounded-xl p-6 text-sm text-slate-300">
          No product templates are active yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            const model = product.baseModel
            const cover = buildImageSrc(model?.coverImagePath || null, model?.updatedAt || null)
            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="rounded-xl border border-white/10 bg-black/30 hover:border-white/30 transition-colors overflow-hidden"
              >
                <div className="aspect-[4/3] bg-slate-900/60 flex items-center justify-center">
                  {cover ? (
                    <img src={cover} alt={product.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-slate-500">No preview</span>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <div className="text-lg font-semibold">{product.title}</div>
                  <div className="text-xs text-slate-400">
                    {model?.material ? `Base material: ${model.material}` : 'Customizable materials'}
                  </div>
                  {model?.priceUsd != null && (
                    <div className="text-sm text-slate-200">
                      From {formatCurrency(model.priceUsd)}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
