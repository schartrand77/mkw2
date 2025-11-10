"use client"
import { useCart } from './CartProvider'

export default function AddToCartButtons({ model }: { model: { id: string, title: string, priceUsd?: number | null, coverImagePath?: string | null, sizeXmm?: number, sizeYmm?: number, sizeZmm?: number } }) {
  const { add, inc, dec, items } = useCart()
  const inCart = items.find(i => i.modelId === model.id)
  const qty = inCart?.options.qty || 0
  const addOne = () => add({ modelId: model.id, title: model.title, priceUsd: model.priceUsd, thumbnail: model.coverImagePath ? `/files${model.coverImagePath}` : null, size: { x: model.sizeXmm, y: model.sizeYmm, z: model.sizeZmm } })
  return (
    <div className="flex items-center gap-2">
      {qty > 0 && (
        <button type="button" className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20" onClick={() => dec(model.id)}>-</button>
      )}
      <button type="button" className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20" onClick={qty > 0 ? () => inc(model.id) : addOne}>{qty > 0 ? '+' : 'Add'}</button>
      {qty > 0 && <span className="text-xs text-slate-400">{qty} in cart</span>}
    </div>
  )
}

