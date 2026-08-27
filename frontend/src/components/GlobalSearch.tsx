import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientsApi } from '../api/clients'
import { bookingsApi } from '../api/bookings'
import { roomsApi } from '../api/rooms'
import { useDebounce } from '../hooks/useDebounce'

interface SearchResult {
  type: 'client' | 'booking' | 'room'
  id: number
  label: string
  sub: string
  path: string
  icon: string
}

export default function GlobalSearch() {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor]   = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const debounced = useDebounce(query, 250)

  // Open on Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50) }
    else { setQuery(''); setResults([]); setCursor(0) }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const [clients, bookings, rooms] = await Promise.all([
        clientsApi.list({ search: q, page_size: '5' }),
        bookingsApi.list({ search: q, page_size: '5' }),
        roomsApi.list({ search: q, page_size: '5' }),
      ])
      const r: SearchResult[] = [
        ...clients.results.map(c => ({
          type: 'client' as const,
          id: c.id,
          label: c.full_name,
          sub: c.email || c.phone,
          path: '/app/clients',
          icon: 'bi-person-fill',
        })),
        ...bookings.results.map(b => ({
          type: 'booking' as const,
          id: b.id,
          label: b.reference,
          sub: `${b.client_detail?.full_name ?? ''} · Chambre #${b.room_detail?.number ?? ''}`,
          path: '/app/bookings',
          icon: 'bi-bookmark-check-fill',
        })),
        ...rooms.results.map(r => ({
          type: 'room' as const,
          id: r.id,
          label: `Chambre #${r.number}`,
          sub: `${r.room_type_name} — ${r.status_display}`,
          path: '/app/rooms',
          icon: 'bi-door-open-fill',
        })),
      ]
      setResults(r)
      setCursor(0)
    } catch {
      // ignore errors silently
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { search(debounced) }, [debounced, search])

  const go = (path: string) => {
    navigate(path)
    setOpen(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && results[cursor]) go(results[cursor].path)
  }

  const TYPE_LABEL: Record<string, string> = { client: 'Client', booking: 'Réservation', room: 'Chambre' }
  const TYPE_COLOR: Record<string, string> = {
    client:  'text-blue-600 bg-blue-50',
    booking: 'text-amber-600 bg-amber-50',
    room:    'text-green-600 bg-green-50',
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4"
      onClick={e => e.target === e.currentTarget && setOpen(false)}>
      <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <i className={`bi ${loading ? 'bi-arrow-repeat animate-spin' : 'bi-search'} text-gray-400 text-lg shrink-0`} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Chercher un client, une réservation, une chambre…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
          <kbd className="shrink-0 text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded border border-gray-200">Esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul className="max-h-80 overflow-y-auto py-2">
            {results.map((r, i) => (
              <li key={`${r.type}-${r.id}`}>
                <button
                  onClick={() => go(r.path)}
                  onMouseEnter={() => setCursor(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === cursor ? 'bg-gray-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLOR[r.type]}`}>
                    <i className={`bi ${r.icon} text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.label}</p>
                    <p className="text-xs text-gray-400 truncate">{r.sub}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[r.type]}`}>
                    {TYPE_LABEL[r.type]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : query && !loading ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            <i className="bi bi-search text-2xl block mb-2 opacity-30" />
            Aucun résultat pour « {query} »
          </div>
        ) : !query ? (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">
            <p>Tapez pour rechercher dans les clients, réservations et chambres</p>
          </div>
        ) : null}

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
          <span><kbd className="bg-gray-100 px-1 rounded border border-gray-200">↑↓</kbd> naviguer</span>
          <span><kbd className="bg-gray-100 px-1 rounded border border-gray-200">↵</kbd> ouvrir</span>
          <span><kbd className="bg-gray-100 px-1 rounded border border-gray-200">Esc</kbd> fermer</span>
        </div>
      </div>
    </div>
  )
}
