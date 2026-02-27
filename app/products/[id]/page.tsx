import Link from 'next/link'
import { prisma } from '@/lib/db'
import { buildImageSrc } from '@/lib/storage'
import ProductConfigurator from '@/components/products/ProductConfigurator'
import MerchConfigurator from '@/components/products/MerchConfigurator'
import PhotoMarquee from '@/components/products/PhotoMarquee'
import { getUserIdFromCookie } from '@/lib/auth'
import { syncStockworksModelsToProductTemplates } from '@/lib/stockworks-products'
import { formatCurrency } from '@/lib/currency'

export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ kind?: string }>
}

export default async function ProductDetailPage({ params, searchParams }: Params) {
  try { await syncStockworksModelsToProductTemplates() } catch {}
  const { id } = await params
  const { kind } = await searchParams
  const viewerId = await getUserIdFromCookie()
  const viewer = viewerId
    ? await prisma.user.findUnique({ where: { id: viewerId }, select: { isAdmin: true, role: true } })
    : null
  const isAdminViewer = Boolean(viewer?.isAdmin || viewer?.role === 'admin' || viewer?.role === 'staff')

  const shouldPrioritizeMerch = String(kind || '').toLowerCase() === 'merch'

  const productPromise = prisma.productTemplate.findFirst({
    where: isAdminViewer ? { id } : { id, isActive: true },
    include: {
      baseModel: {
        select: {
          id: true,
          title: true,
          description: true,
          priceUsd: true,
          effectivePriceUsd: true,
          salePriceUsd: true,
          material: true,
          flatRatePricing: true,
          sizeXmm: true,
          sizeYmm: true,
          sizeZmm: true,
          coverImagePath: true,
          updatedAt: true,
          images: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            take: 8,
            select: { filePath: true, createdAt: true, status: true },
          },
        },
      },
    },
  })
  const merchPromise = prisma.merchItem.findFirst({
    where: isAdminViewer ? { id } : { id, isActive: true },
  })

  const [product, merch] = await Promise.all([
    shouldPrioritizeMerch ? Promise.resolve(null) : productPromise,
    merchPromise,
  ])
  const resolvedProduct = product || (!merch ? await productPromise : null)

  if (merch && (shouldPrioritizeMerch || !resolvedProduct)) {
    const rawMerchGallery = Array.isArray((merch as any).galleryImageUrls) ? ((merch as any).galleryImageUrls as string[]) : []
    const merchImages = Array.from(new Set([
      ...rawMerchGallery.map((entry) => buildImageSrc(entry, merch.updatedAt || null)),
      buildImageSrc(merch.imageUrl || null, merch.updatedAt || null),
    ].filter((entry): entry is string => Boolean(entry))))
    const merchCover = merchImages[0] || null
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/products#merch" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <span aria-hidden="true">&larr;</span>
            Back to merch
          </Link>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="glass rounded-2xl border border-white/10 p-6">
              <h1 className="text-3xl font-semibold">{merch.title}</h1>
              {!merch.isActive && isAdminViewer && (
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mt-2">Hidden from customers (admin preview)</p>
              )}
              <p className="text-sm text-slate-300 mt-3 whitespace-pre-wrap">
                {merch.description || 'No description provided.'}
              </p>
              <div className="mt-4 text-sm text-slate-200">
                {merch.priceUsd != null ? formatCurrency(merch.priceUsd) : 'Price on request'}
              </div>
            </div>
            <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-slate-300 grid md:grid-cols-[1fr_320px] gap-4 items-start">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Merch details</div>
                <div>Category: {merch.category || 'Merch'}</div>
                <div>Availability: {merch.availability === 'back_ordered' ? 'Back ordered' : 'In stock'}</div>
                <div>Store options: Colors and apparel sizes available on this page.</div>
              </div>
              <PhotoMarquee images={merchImages} altBase={merch.title} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              {merchCover ? (
                <img src={merchCover} alt={merch.title} className="w-full aspect-[4/3] object-cover bg-slate-900/70" />
              ) : (
                <div className="aspect-[4/3] flex items-center justify-center text-xs text-slate-500 bg-slate-900/70">No image</div>
              )}
            </div>
            <MerchConfigurator
              item={{
                id: merch.id,
                title: merch.title,
                category: merch.category,
                availability: merch.availability,
                externalUrl: merch.externalUrl,
                ctaLabel: merch.ctaLabel,
                sizeOptions: Array.isArray((merch as any).sizeOptions) ? (merch as any).sizeOptions : null,
                colorOptions: Array.isArray((merch as any).colorOptions) ? (merch as any).colorOptions : null,
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (!resolvedProduct) return <div className="max-w-2xl mx-auto text-sm text-slate-300">Product not found.</div>

  const cover = buildImageSrc(resolvedProduct.baseModel?.coverImagePath || null, resolvedProduct.baseModel?.updatedAt || null)
  const baseModelImages = resolvedProduct.baseModel
    ? [
      cover,
      ...(((resolvedProduct.baseModel as any).images || [])
        .filter((img: any) => String(img?.status || 'ready').toLowerCase() === 'ready')
        .map((img: any) => buildImageSrc(img?.filePath || null, img?.createdAt || null))),
    ].filter((src): src is string => Boolean(src))
    : []
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
            <h1 className="text-3xl font-semibold">{resolvedProduct.title}</h1>
            {!resolvedProduct.isActive && isAdminViewer && (
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mt-2">Hidden from customers (admin preview)</p>
            )}
            <p className="text-sm text-slate-300 mt-3 whitespace-pre-wrap">
              {resolvedProduct.description || resolvedProduct.baseModel?.description || 'No description provided.'}
            </p>
          </div>
          {resolvedProduct.baseModel && (
            <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-slate-300 grid md:grid-cols-[1fr_320px] gap-4 items-start">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Base model</div>
                <div className="font-semibold">{resolvedProduct.baseModel.title}</div>
                <div>Default material: {resolvedProduct.baseModel.material || 'PLA'}</div>
                <div>
                  Size: {resolvedProduct.baseModel.sizeXmm ? `${Math.round(resolvedProduct.baseModel.sizeXmm)} x ${Math.round(resolvedProduct.baseModel.sizeYmm || 0)} x ${Math.round(resolvedProduct.baseModel.sizeZmm || 0)} mm` : 'Customizable'}
                </div>
              </div>
              <PhotoMarquee images={baseModelImages} altBase={resolvedProduct.baseModel.title} />
            </div>
          )}
        </div>
        <ProductConfigurator
          product={{
            id: resolvedProduct.id,
            title: resolvedProduct.title,
            description: resolvedProduct.description,
            baseModelId: resolvedProduct.baseModelId,
            lockedMaterial: resolvedProduct.lockedMaterial,
            lockedColor: resolvedProduct.lockedColor,
            lockedColorCount: resolvedProduct.lockedColorCount,
            lockedScale: resolvedProduct.lockedScale,
            lockedFinish: resolvedProduct.lockedFinish,
            lockedPriceMultiplier: resolvedProduct.lockedPriceMultiplier,
            colorOptions: Array.isArray((resolvedProduct as any).colorOptions) ? (resolvedProduct as any).colorOptions : null,
          }}
          baseModel={resolvedProduct.baseModel}
          coverUrl={cover}
        />
      </div>
    </div>
  )
}
