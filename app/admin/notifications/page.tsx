import PushNotificationsCard from '@/components/admin/PushNotificationsCard'

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Notifications</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage browser push notifications for admin alerts on this device.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
        <h2 className="mb-4 text-lg font-semibold">Push notifications</h2>
        <PushNotificationsCard />
      </div>
    </div>
  )
}
