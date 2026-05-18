import Link from 'next/link'
import type { ReactNode } from 'react'
import { prisma } from '@/lib/db'
import { buildImageSrc } from '@/lib/storage'
import ProductConfigurator from '@/components/products/ProductConfigurator'
import MerchConfigurator from '@/components/products/MerchConfigurator'
import { getUserIdFromCookie } from '@/lib/auth'
import { syncStockworksModelsToProductTemplates } from '@/lib/stockworks-products'

export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ kind?: string }>
}

function ProductMediaGallery({ images, title }: { images: string[]; title: string }) {
  const gallery = images.length > 0 ? images : []
  const hero = gallery[0] || null

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
        {hero ? (
          <img src={hero} alt={title} className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center text-sm text-slate-500">No product image</div>
        )}
      </div>
      {gallery.length > 1 && (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {gallery.slice(0, 10).map((src, index) => (
            <div key={`${src}-${index}`} className="overflow-hidden rounded-lg border border-white/10 bg-slate-950">
              <img src={src} alt={`${title} view ${index + 1}`} className="aspect-square w-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-slate-300">{children}</div>
    </section>
  )
}

function SpecGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{row.label}</div>
          <div className="mt-1 font-medium text-slate-100">{row.value}</div>
        </div>
      ))}
    </div>
  )
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
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link href="/products#merch" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <span aria-hidden="true">&larr;</span>
            Back to merch
          </Link>
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_420px]">
          <div className="space-y-6">
            <ProductMediaGallery images={merchImages} title={merch.title} />
            <div className="space-y-4">
              <DetailSection title="Product details">
                <p className="whitespace-pre-wrap">{merch.description || 'No description provided.'}</p>
                {!merch.isActive && isAdminViewer && (
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">Hidden from customers (admin preview)</p>
                )}
              </DetailSection>
              <DetailSection title="Merch details">
                <SpecGrid
                  rows={[
                    { label: 'Category', value: merch.category || 'Merch' },
                    { label: 'Availability', value: merch.availability === 'back_ordered' ? 'Back ordered' : 'In stock' },
                    { label: 'Options', value: 'Colors and apparel sizes available on this page' },
                  ]}
                />
              </DetailSection>
            </div>
          </div>
          <aside className="sticky top-24 self-start">
            <h1 className="mb-4 text-3xl font-semibold leading-tight lg:text-4xl">{merch.title}</h1>
            <MerchConfigurator
              item={{
                id: merch.id,
                title: merch.title,
                category: merch.category,
                availability: merch.availability,
                priceUsd: merch.priceUsd,
                externalUrl: merch.externalUrl,
                ctaLabel: merch.ctaLabel,
                sizeOptions: Array.isArray((merch as any).sizeOptions) ? (merch as any).sizeOptions : null,
                colorOptions: Array.isArray((merch as any).colorOptions) ? (merch as any).colorOptions : null,
              }}
            />
          </aside>
        </div>
      </div>
    )
  }

  if (!resolvedProduct) return <div className="max-w-2xl mx-auto text-sm text-slate-300">Product not found.</div>

  const coverPath = String(resolvedProduct.baseModel?.coverImagePath || '').trim()
  const cover = buildImageSrc(coverPath || null, resolvedProduct.baseModel?.updatedAt || null)
  const baseModelImages = resolvedProduct.baseModel
    ? [
      cover,
      ...(((resolvedProduct.baseModel as any).images || [])
        .filter((img: any) => String(img?.status || 'ready').toLowerCase() === 'ready')
        .filter((img: any) => {
          const filePath = String(img?.filePath || '').trim()
          return filePath && (!coverPath || filePath !== coverPath)
        })
        .map((img: any) => buildImageSrc(img?.filePath || null, img?.createdAt || null))),
    ].filter((src): src is string => Boolean(src))
    : []
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Link href="/products" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <span aria-hidden="true">&larr;</span>
          Back to products
        </Link>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_420px]">
        <div className="space-y-6">
          <ProductMediaGallery images={baseModelImages} title={resolvedProduct.title} />
          <div className="space-y-4">
            <DetailSection title="Product details">
              <p className="whitespace-pre-wrap">
                {resolvedProduct.description || resolvedProduct.baseModel?.description || 'No description provided.'}
              </p>
              {!resolvedProduct.isActive && isAdminViewer && (
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">Hidden from customers (admin preview)</p>
              )}
            </DetailSection>
            {resolvedProduct.baseModel && (
              <>
                <DetailSection title="Print specs">
                  <SpecGrid
                    rows={[
                      { label: 'Material', value: resolvedProduct.lockedMaterial || resolvedProduct.baseModel.material || 'PLA' },
                      { label: 'Finish', value: resolvedProduct.lockedFinish || 'Standard' },
                      { label: 'Color slots', value: String(resolvedProduct.lockedColorCount || 1) },
                      {
                        label: 'Size',
                        value: resolvedProduct.baseModel.sizeXmm
                          ? `${Math.round(resolvedProduct.baseModel.sizeXmm)} x ${Math.round(resolvedProduct.baseModel.sizeYmm || 0)} x ${Math.round(resolvedProduct.baseModel.sizeZmm || 0)} mm`
                          : 'Customizable',
                      },
                    ]}
                  />
                </DetailSection>
                <DetailSection title="Based on">
                  <div className="font-semibold text-slate-100">{resolvedProduct.baseModel.title}</div>
                  <p className="mt-1 text-slate-400">This store product uses a locked MakerWorks print configuration for predictable ordering and production.</p>
                </DetailSection>
              </>
            )}
          </div>
        </div>
        <aside className="sticky top-24 self-start">
          <h1 className="mb-4 text-3xl font-semibold leading-tight lg:text-4xl">{resolvedProduct.title}</h1>
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
        </aside>
      </div>
    </div>
  )
}
