import { useEffect, useState } from 'react'
import { authApi, AuditEntry } from '../api/auth'

function fmtDate(d: string) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function LoginHistoryList() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)

  useEffect(() => {
    authApi.loginHistory().then(setEntries).catch(() => setEntries([]))
  }, [])

  if (entries === null) {
    return <p className="text-sm text-gray-400">Chargement…</p>
  }
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400">Aucune activité récente.</p>
  }

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto">
      {entries.map(e => (
        <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
          <div className="flex items-center gap-2">
            <i className={`bi ${e.action === 'login' ? 'bi-box-arrow-in-right text-green-500' : 'bi-box-arrow-left text-gray-400'}`} />
            <span className="text-gray-700 dark:text-gray-300">{e.action_display}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {e.ip_address && <span className="font-mono">{e.ip_address}</span>}
            <span>{fmtDate(e.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
