'use client'

export default function PrintTicketButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 py-2 rounded-md border border-white/10 hover:border-white/30 text-sm"
    >
      Print ticket
    </button>
  )
}