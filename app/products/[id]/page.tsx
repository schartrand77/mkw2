import Link from 'next/link'
import { prisma } from '@/lib/db'
import { buildImageSrc } from '@/lib/storage'
import ProductConfigurator from '@/components/products/ProductConfigurator'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export default async function ProductDetailPage({ params }: Params) {
  const { id } = await params
  const product = await prisma.productTemplate.findFirst({
    where: {
      id,
      isActive: true,
      OR: [
        { baseModelId: null },
        { baseModel: { is: { visibility: 'public' } } },
      ],
    },
    include: {
      baseModel: {
        select: {
          id: true,
          title: true,
          description: true,
          priceUsd: true,
          material: true,
          flatRatePricing: true,
          sizeXmm: true,
          sizeYmm: true,
          sizeZmm: true,
          visibility: true,
          coverImagePath: true,
          updatedAt: true,
        },
      },
    },
  })
  if (!product) return <div className="max-w-2xl mx-auto text-sm text-slate-300">Product not found.</div>
  const cover = buildImageSrc(product.baseModel?.coverImagePath || null, product.baseModel?.updatedAt || null)
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/products" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <span aria-hidden="true">&larr;</span>
          Back to products
        </Link>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="glass rounded-2xl border border-white/10 p-6">
            <h1 className="text-3xl font-semibold">{product.title}</h1>
            <p className="text-sm text-slate-300 mt-3 whitespace-pre-wrap">
              {product.description || product.baseModel?.description || 'No description provided.'}
            </p>
          </div>
          {product.baseModel && (
            <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-slate-300 space-y-2">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Base model</div>
              <div className="font-semibold">{product.baseModel.title}</div>
              <div>Default material: {product.baseModel.material || 'PLA'}</div>
              <div>
                Size: {product.baseModel.sizeXmm ? `${Math.round(product.baseModel.sizeXmm)} x ${Math.round(product.baseModel.sizeYmm || 0)} x ${Math.round(product.baseModel.sizeZmm || 0)} mm` : 'Customizable'}
              </div>
            </div>
          )}
        </div>
        <ProductConfigurator
          product={{
            id: product.id,
            title: product.title,
            description: product.description,
            baseModelId: product.baseModelId,
            materialOptions: product.materialOptions as any,
            colorOptions: product.colorOptions as any,
            sizeOptions: product.sizeOptions as any,
          }}
          baseModel={product.baseModel}
          coverUrl={cover}
        />
      </div>
    </div>
  )
}
