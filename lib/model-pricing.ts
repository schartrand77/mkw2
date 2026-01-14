import { prisma } from '@/lib/db'
import { estimatePriceUSD, resolveModelPricing } from '@/lib/pricing'

export async function updateModelPricingForModel(modelId: string) {
  const cfg = await prisma.siteConfig.findUnique({ where: { id: 'main' } })
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: { id: true, material: true },
  })
  if (!model) return
  const parts = await prisma.modelPart.findMany({
    where: { modelId },
    select: { id: true, volumeMm3: true, sizeXmm: true, sizeYmm: true, sizeZmm: true },
    orderBy: { index: 'asc' },
  })
  if (parts.length === 0) return
  if (!parts.every((part) => part.volumeMm3 != null)) return

  const isMultipart = parts.length > 1
  const totalVolMm3 = parts.reduce((sum, part) => sum + (part.volumeMm3 || 0), 0)
  if (totalVolMm3 <= 0) return

  let totalPrice = parts.reduce((sum, part) => {
    const cm3 = (part.volumeMm3 || 0) / 1000
    return sum + estimatePriceUSD({ cm3, material: model.material, cfg, applyMinimum: !isMultipart })
  }, 0)

  if (isMultipart) {
    const totalWithMinimum = estimatePriceUSD({ cm3: totalVolMm3 / 1000, material: model.material, cfg, applyMinimum: true })
    totalPrice = totalWithMinimum
    for (const part of parts) {
      const vol = part.volumeMm3 || 0
      const price = vol > 0 ? Number(((totalWithMinimum * vol) / totalVolMm3).toFixed(2)) : 0
      await prisma.modelPart.update({
        where: { id: part.id },
        data: { priceUsd: price },
      })
    }
  } else {
    await prisma.modelPart.update({
      where: { id: parts[0].id },
      data: { priceUsd: totalPrice },
    })
  }

  const effectivePriceUsd = resolveModelPricing({
    volumeMm3: totalVolMm3,
    material: model.material,
    priceUsd: totalPrice,
    salePriceUsd: null,
  }, cfg).priceUsd

  const size = !isMultipart && parts[0]
    ? { sizeXmm: parts[0].sizeXmm ?? undefined, sizeYmm: parts[0].sizeYmm ?? undefined, sizeZmm: parts[0].sizeZmm ?? undefined }
    : { sizeXmm: undefined, sizeYmm: undefined, sizeZmm: undefined }

  await prisma.model.update({
    where: { id: modelId },
    data: {
      volumeMm3: totalVolMm3 || undefined,
      priceUsd: totalPrice || undefined,
      effectivePriceUsd: effectivePriceUsd ?? undefined,
      effectivePriceUpdatedAt: effectivePriceUsd != null ? new Date() : undefined,
      ...size,
    },
  })
}
