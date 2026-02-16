export const dynamic = 'force-dynamic'

import HomeCommentsManager from '@/components/admin/HomeCommentsManager'

export default function AdminHomeCommentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Home comments</h1>
        <p className="mt-1 text-sm text-slate-400">Select which model comments appear on the home page and remove comments when needed.</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
        <HomeCommentsManager />
      </div>
    </div>
  )
}

