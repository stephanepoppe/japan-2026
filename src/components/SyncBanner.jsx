import { status, dismissRejected, useStore } from '../lib/sync'

/** "N changes waiting to sync", plus anything the server refused (Q4, Q7). */
export default function SyncBanner() {
  const { waiting, busy, rejected } = useStore(status)
  return (
    <>
      {waiting > 0 && !busy && (
        <p className="text-sm text-dim">{waiting} change{waiting === 1 ? '' : 's'} waiting to sync</p>
      )}
      {rejected.length > 0 && (
        <p className="flex items-start justify-between gap-3 text-sm text-ai">
          {rejected.length} change{rejected.length === 1 ? '' : 's'} couldn’t be saved: {rejected.join(', ')}
          <button className="cursor-pointer text-lg leading-none" onClick={dismissRejected} aria-label="Dismiss">×</button>
        </p>
      )}
    </>
  )
}
