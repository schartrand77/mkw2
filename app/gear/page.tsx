import { AMAZON_MARKETPLACE_HOST, normalizeAmazonAffiliateUrl } from '@/lib/amazon'
import { getAmazonSpotlightCards } from '@/lib/amazonSpotlights'
import { BRAND_FULL_NAME, BRAND_LAB_NAME, BRAND_NAME } from '@/lib/brand'

export const metadata = {
  title: `Amazon Accessories Shop | ${BRAND_FULL_NAME}`,
  description: 'Curated Amazon affiliate picks for 3D printing accessories, tools, and workspace upgrades.',
}

export default async function AmazonStorePage() {
  const supportShoppingUrl =
    normalizeAmazonAffiliateUrl(`https://${AMAZON_MARKETPLACE_HOST}`) ||
    `https://${AMAZON_MARKETPLACE_HOST}`
  const spotlightItems = await getAmazonSpotlightCards()

  return (
    <div className="space-y-10">
      <section className="glass rounded-3xl border border-white/10 px-6 py-8 md:px-10 md:py-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-gradient-to-r from-brand-600/40 via-transparent to-accent-500/30" />
        <div className="relative space-y-4 text-center md:text-left">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Amazon partner page</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            3D Printing Accessories, Filtered for Makers
          </h1>
          <p className="text-slate-300 md:text-lg max-w-3xl mx-auto md:mx-0">
            Browse Amazon results already narrowed to <span className="text-white font-medium">3D printing accessories</span>.
            Every card below links to a collection we use in the {BRAND_LAB_NAME}&mdash;dry boxes, nozzle kits, finishing gear, and more.
          </p>
          <p className="text-slate-300 text-sm md:text-base max-w-3xl mx-auto md:mx-0">
            Prefer regular shopping? Click the support button before you buy anything on Amazon and a portion of that purchase still helps keep {BRAND_NAME} running.
          </p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
            <a
              href={supportShoppingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn text-base"
            >
              Shop Amazon & support {BRAND_NAME}
            </a>
          </div>
          <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                Direct Amazon shortcuts
              </p>
              <p className="text-xs text-slate-400 md:text-right">
                Tap any tag to jump straight to a 3D-printing ready search powered by our affiliate ID.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {spotlightItems.map((item) => (
                <a
                  key={`shortcut-${item.id}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex flex-col rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition hover:border-white/30 hover:bg-white/[0.08]"
                >
                  <span className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-500">
                    {item.category}
                  </span>
                  <span className="text-sm text-white group-hover:text-white/90">{item.displayTitle}</span>
                </a>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-400 pt-2">
            As an Amazon Associate, {BRAND_NAME} may earn from qualifying purchases. Pricing and availability update on Amazon in real time.
          </p>
        </div>
      </section>
    </div>
  )
}
