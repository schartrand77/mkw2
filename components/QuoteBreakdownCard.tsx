"use client"

import { formatCurrency, type Currency } from '@/lib/currency'
import type { PricingDetails } from '@/lib/pricing'

type QuoteAdjustments = {
  batchDiscountPercent?: number
  rush?: boolean
  demandSurgeMultiplier?: number
  rushMultiplier?: number
}

type LeadTimeSignals = {
  baseHours: number
  queueHours: number
  queueDelayHours: number
  capacityHoursPerDay: number
  printerAvailabilityPercent: number
  materialAvailability: 'in_stock' | 'limited' | 'out_of_stock' | 'unknown'
}

type Props = {
  currency?: Currency
  title?: string
  pricing?: PricingDetails | null
  unitPrice?: number | null
  varianceLabel?: string | null
  confidenceScore?: number | null
  adjustments?: QuoteAdjustments | null
  leadTimeSignals?: LeadTimeSignals | null
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return `${Math.round(value * 100)}%`
}

function formatMaterialAvailability(value?: LeadTimeSignals['materialAvailability']) {
  switch (value) {
    case 'in_stock':
      return 'In stock'
    case 'limited':
      return 'Limited stock'
    case 'out_of_stock':
      return 'Out of stock'
    default:
      return 'Unknown'
  }
}

export default function QuoteBreakdownCard({
  currency = 'USD',
  title = 'Quote breakdown',
  pricing,
  unitPrice,
  varianceLabel,
  confidenceScore,
  adjustments,
  leadTimeSignals,
}: Props) {
  if (!pricing && !adjustments && !leadTimeSignals && unitPrice == null && !varianceLabel && confidenceScore == null) {
    return null
  }

  const confidenceText = formatPercent(confidenceScore)
  const rushActive = Boolean(adjustments?.rush)
  const surgeActive = typeof adjustments?.demandSurgeMultiplier === 'number' && adjustments.demandSurgeMultiplier > 1
  const batchDiscountActive = typeof adjustments?.batchDiscountPercent === 'number' && adjustments.batchDiscountPercent > 0
  const showPricing = Boolean(pricing || batchDiscountActive || rushActive || surgeActive)
  const showLeadTime = Boolean(confidenceText || varianceLabel || leadTimeSignals)

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-300 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{title}</p>
          <p className="text-slate-400">Cost drivers and lead-time confidence for this configuration.</p>
        </div>
        {unitPrice != null && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Unit quote</p>
            <p className="text-sm font-semibold text-white">{formatCurrency(unitPrice, currency)}</p>
          </div>
        )}
      </div>

      {showPricing && (
        <details className="rounded-lg border border-white/10 bg-black/20 p-2" open>
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Pricing drivers</span>
            <span className="text-slate-500">{pricing ? `${pricing.hours.toFixed(2)} hrs` : 'Adjustments'}</span>
          </summary>
          <div className="mt-3 space-y-3">
            {pricing && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-slate-500">Material estimate</div>
                  <div className="mt-1 font-medium text-white">
                    {pricing.grams.toFixed(1)} g
                    <span className="text-slate-400 font-normal"> | {pricing.effectiveCm3.toFixed(1)} cm^3 effective</span>
                  </div>
                  <div className="text-slate-400 mt-1">
                    Material {formatCurrency(pricing.materialCost, currency)}
                    {pricing.supportRatio != null ? ` | Supports ${Math.round(pricing.supportRatio * 100)}%` : ''}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-slate-500">Machine time</div>
                  <div className="mt-1 font-medium text-white">{pricing.hours.toFixed(2)} hrs</div>
                  <div className="text-slate-400 mt-1">
                    Machine {formatCurrency(pricing.machineCost, currency)} | Labor {formatCurrency(pricing.laborCost, currency)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-slate-500">Process adjustments</div>
                  <div className="mt-1 text-slate-400">
                    Finish {pricing.finish ? pricing.finish : 'standard'}
                    {pricing.finishSurcharge > 0 ? ` | +${Math.round(pricing.finishSurcharge * 100)}%` : ' | no surcharge'}
                  </div>
                  <div className="text-slate-400 mt-1">
                    {pricing.colorCount && pricing.colorCount > 1
                      ? `${pricing.colorCount} colors | ${Math.round((pricing.colorTimeMultiplier - 1) * 100)}% extra time`
                      : 'Single-color timing'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-slate-500">Estimator profile</div>
                  <div className="mt-1 text-slate-400">{pricing.printerProfile.label} | {pricing.nozzleDiameterMm.toFixed(2)} mm nozzle</div>
                  <div className="text-slate-400 mt-1">
                    {pricing.minimumApplied ? 'Minimum order floor applied' : 'Calculated from geometry and process settings'}
                  </div>
                </div>
              </div>
            )}
            {(batchDiscountActive || rushActive || surgeActive) && (
              <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-slate-400">
                {batchDiscountActive ? `Batch discount ${adjustments?.batchDiscountPercent}%` : 'No batch discount'}
                {rushActive && adjustments?.rushMultiplier ? ` | Rush x${adjustments.rushMultiplier.toFixed(2)}` : ''}
                {surgeActive && adjustments?.demandSurgeMultiplier ? ` | Demand x${adjustments.demandSurgeMultiplier.toFixed(2)}` : ''}
              </div>
            )}
          </div>
        </details>
      )}

      {showLeadTime && (
        <details className="rounded-lg border border-white/10 bg-black/20 p-2" open>
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Lead-time confidence</span>
            <span className="text-slate-500">{confidenceText || varianceLabel || 'Details'}</span>
          </summary>
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400">
              {confidenceText && <span>Confidence {confidenceText}</span>}
              {varianceLabel && <span>Expected range {varianceLabel}</span>}
              {leadTimeSignals && <span>Material {formatMaterialAvailability(leadTimeSignals.materialAvailability)}</span>}
            </div>
            {leadTimeSignals && (
              <div className="text-slate-500">
                Base {leadTimeSignals.baseHours.toFixed(1)} hrs | Queue delay {leadTimeSignals.queueDelayHours.toFixed(1)} hrs | Printer availability {Math.round(leadTimeSignals.printerAvailabilityPercent)}%
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
