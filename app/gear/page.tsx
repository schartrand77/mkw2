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
            <a
              href="https://www.amazon.ca/associates"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-md border border-white/15 text-sm text-slate-300 hover:border-white/30"
            >
              About affiliate links
            </a>
          </div>
          <p className="text-xs text-slate-400 pt-2">
            As an Amazon Associate, {BRAND_NAME} may earn from qualifying purchases. Pricing and availability update on Amazon in real time.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Curated picks</p>
          <h2 className="text-2xl font-semibold">Lab-tested accessories</h2>
          <p className="text-slate-400 max-w-3xl">
            Each collection links to Amazon searches focused on 3D printing accessories so you land on relevant stock right away.
            Tap through to compare listings, Prime options, and bundle upgrades.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {spotlightItems.map((item) => (
            <article
              key={item.id}
              className="glass rounded-2xl border border-white/10 overflow-hidden flex flex-col hover:border-white/20 transition"
            >
              <div className="relative aspect-video">
                <img
                  src={item.displayImage || item.image}
                  alt={item.displayTitle}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-4 text-xs uppercase tracking-[0.2em] text-slate-200">
                  {item.category}
                </div>
              </div>
              <div className="p-5 flex flex-col gap-4 grow">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">{item.displayTitle}</h3>
                    <span className="text-sm text-slate-400">{item.priceHint}</span>
                  </div>
                  <p className="text-sm text-slate-300">{item.descriptionFromAmazon || item.description}</p>
                </div>
                <ul className="space-y-1 text-sm text-slate-400">
                  {item.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2">
                      <span aria-hidden="true" className="text-brand-500">-</span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs uppercase tracking-wide px-2 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  {item.rating ? (
                    <span>{item.rating.toFixed(1)} * avg rating</span>
                  ) : (
                    <span>Amazon-verified picks</span>
                  )}
                  <span>{item.primeEligible ? 'Prime friendly' : 'Ships via Amazon'}</span>
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn w-full text-center mt-auto"
                >
                  View on Amazon
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
