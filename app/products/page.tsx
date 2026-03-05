import Link from 'next/link'
import { prisma } from '@/lib/db'
import { buildImageSrc } from '@/lib/storage'
import { formatCurrency } from '@/lib/currency'
import { getUserIdFromCookie } from '@/lib/auth'
import { resolveModelPricing } from '@/lib/pricing'
import { syncStockworksModelsToProductTemplates } from '@/lib/stockworks-products'
import { filterLinkedVariantTemplates } from '@/lib/product-template-variants'

export const dynamic = 'force-dynamic'

const fallbackMerchIdeas = [
  { title: 'T-Shirts', description: 'Logo tees and event shirts.', category: 'Apparel' },
  { title: 'Lanyards', description: 'Badge and key lanyards.', category: 'Accessories' },
  { title: 'Hoodies', description: 'Branded hoodies and crews.', category: 'Apparel' },
]

export default async function ProductsPage() {
  try { await syncStockworksModelsToProductTemplates() } catch {}
  const viewerId = await getUserIdFromCookie()
  const viewer = viewerId
    ? await prisma.user.findUnique({ where: { id: viewerId }, select: { isAdmin: true, role: true } })
    : null
  const isAdminViewer = Boolean(viewer?.isAdmin || viewer?.role === 'admin' || viewer?.role === 'staff')

  const [allProducts, merchItems, config] = await Promise.all([
    prisma.productTemplate.findMany({
      where: isAdminViewer ? undefined : { isActive: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        baseModel: {
          select: {
            id: true,
            title: true,
            priceUsd: true,
            effectivePriceUsd: true,
            salePriceUsd: true,
            material: true,
            flatRatePricing: true,
            coverImagePath: true,
            updatedAt: true,
          },
        },
      },
    }),
    prisma.merchItem.findMany({
      where: isAdminViewer ? undefined : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    }),
    prisma.siteConfig.upsert({
      where: { id: 'main' },
      update: {},
      create: { id: 'main' },
      select: {
        productsModelsLabel: true,
        productsMerchLabel: true,
      },
    }),
  ])
  const products = filterLinkedVariantTemplates(allProducts)

  const modelsLabel = (config.productsModelsLabel || '').trim() || 'Models'
  const merchLabel = (config.productsMerchLabel || '').trim() || 'Merch'
  const merchGroups = Array.from(
    merchItems.reduce((acc, item) => {
      const key = (item.category || 'Merch').trim() || 'Merch'
      if (!acc.has(key)) acc.set(key, [])
      acc.get(key)!.push(item)
      return acc
    }, new Map<string, typeof merchItems>()),
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold">Store</h1>
        <p className="text-sm text-slate-400">Browse by category: configured print models and business-specific merch.</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-3">Categories</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <a href="#models" className="rounded-full border border-white/20 px-3 py-1.5 hover:border-white/40">{modelsLabel}</a>
          <a href="#merch" className="rounded-full border border-white/20 px-3 py-1.5 hover:border-white/40">{merchLabel}</a>
        </div>
      </div>

      <section id="models" className="space-y-3 scroll-mt-20">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{modelsLabel}</h2>
          <span className="text-xs text-slate-400">Locked print configs</span>
        </div>
        {products.length === 0 ? (
          <div className="glass rounded-xl p-6 text-sm text-slate-300">
            No model products are active yet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => {
              const model = product.baseModel
              const cover = buildImageSrc(model?.coverImagePath || null, model?.updatedAt || null)
              const resolvedPrice = model ? resolveModelPricing(model).priceUsd : null
              return (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className={`rounded-xl border bg-black/30 transition-colors overflow-hidden ${
                    product.isActive
                      ? 'border-white/10 hover:border-white/30'
                      : 'border-slate-700/80 opacity-60 grayscale hover:border-slate-500/80'
                  }`}
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
                    {!product.isActive && isAdminViewer && (
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Hidden (admin only)</div>
                    )}
                    <div className="text-xs text-slate-400">
                      {product.lockedMaterial ? `Material: ${product.lockedMaterial}` : (model?.material ? `Base material: ${model.material}` : 'Configured product')}
                    </div>
                    {resolvedPrice != null && (
                      <div className="text-sm text-slate-200">
                        From {formatCurrency(resolvedPrice)}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section id="merch" className="space-y-3 scroll-mt-20">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{merchLabel}</h2>
          <span className="text-xs text-slate-400">Apparel and accessories</span>
        </div>
        {merchGroups.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
              No merch configured yet. Admins can add custom merch from <code>Admin -&gt; Catalog manager</code>.
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {fallbackMerchIdeas.map((item) => (
                <article key={item.title} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{item.category}</div>
                  <div className="text-lg font-semibold">{item.title}</div>
                  <div className="text-sm text-slate-400">{item.description}</div>
                  <div className="text-xs text-amber-200">Template item</div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {merchGroups.map(([category, entries]) => (
              <div key={category} className="space-y-2">
                <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400">{category}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {entries.map((item) => (
                    <Link key={item.id} href={`/products/${item.id}?kind=merch`} className="rounded-xl border border-white/10 bg-black/30 overflow-hidden transition-colors hover:border-white/30">
                      {buildImageSrc(
                        (Array.isArray((item as any).galleryImageUrls) && (item as any).galleryImageUrls.length > 0
                          ? String((item as any).galleryImageUrls[0] || '')
                          : (item.imageUrl || null)),
                        item.updatedAt || null,
                      ) ? (
                        <img
                          src={buildImageSrc(
                            (Array.isArray((item as any).galleryImageUrls) && (item as any).galleryImageUrls.length > 0
                              ? String((item as any).galleryImageUrls[0] || '')
                              : (item.imageUrl || null)),
                            item.updatedAt || null,
                          ) || ''}
                          alt={item.title}
                          className="w-full h-40 object-cover bg-slate-900/70"
                        />
                      ) : (
                        <div className="h-40 flex items-center justify-center text-xs text-slate-500 bg-slate-900/70">No image</div>
                      )}
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-lg font-semibold">{item.title}</div>
                          {item.availability === 'back_ordered' && (
                            <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                              Back Ordered
                            </span>
                          )}
                        </div>
                        {item.description && <div className="text-sm text-slate-400">{item.description}</div>}
                        <div className="text-sm text-slate-200">
                          {item.priceUsd != null ? formatCurrency(item.priceUsd) : 'Price on request'}
                        </div>
                        <div className="text-xs text-slate-400 underline underline-offset-4">View details</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
