type PaymentBadgesProps = {
  showApplePay?: boolean
  showGooglePay?: boolean
  className?: string
}

const BADGE_IMAGE_CLASS = 'h-6 max-w-none object-contain opacity-90'

export function PaymentBadges({ showApplePay, showGooglePay, className = '' }: PaymentBadgesProps) {
  if (!showApplePay && !showGooglePay) return null

  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      {showApplePay && (
        <img
          src="/ApplePay.svg"
          alt="Apple Pay"
          width={63}
          height={24}
          className={BADGE_IMAGE_CLASS}
          loading="lazy"
        />
      )}
      {showGooglePay && (
        <img
          src="/GooglePay.png"
          alt="Google Pay"
          width={72}
          height={24}
          className={BADGE_IMAGE_CLASS}
          loading="lazy"
        />
      )}
    </span>
  )
}
