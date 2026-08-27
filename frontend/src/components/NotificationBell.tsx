import { useState, useEffect, useRef } from 'react'
import { bookingsApi, Notifications } from '../api/bookings'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loadSettings, Settings } from '../pages/SettingsPage'

function playChime() {
  try {
    const ctx = new AudioContext()
    const notes = [880, 1100]
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc.start(t)
      osc.stop(t + 0.35)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch {
    // Web Audio API non disponible
  }
}

export default function NotificationBell() {
  const { user } = useAuth()
  const [data, setData] = useState<Notifications | null>(null)
  const [open, setOpen] = useState(false)
  const [read, setRead] = useState(false)
  const ref      = useRef<HTMLDivElement>(null)
  const prevCount = useRef<number>(0)
  const navigate = useNavigate()

  const [notifSound, setNotifSound] = useState<boolean>(
    () => loadSettings(user?.username ?? 'guest').notifSound
  )

  useEffect(() => {
    const handler = (e: Event) =>
      setNotifSound((e as CustomEvent<Settings>).detail.notifSound)
    window.addEventListener('mh-settings-changed', handler)
    return () => window.removeEventListener('mh-settings-changed', handler)
  }, [])

  useEffect(() => {
    const fetch = (isInit = false) => {
      bookingsApi.notifications().then(d => {
        setData(d)
        setRead(false)
        if (!isInit && d.count > prevCount.current && notifSound) {
          playChime()
        }
        prevCount.current = d.count
      }).catch(() => {})
    }
    fetch(true)
    const id = setInterval(() => fetch(), 5 * 60 * 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifSound])

  // Fermer en cliquant à l'extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const count = data?.count ?? 0
  const hasNew = count > 0 && !read

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setRead(true) }}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
        title="Notifications"
      >
        <i className="bi bi-bell-fill text-lg" />
        {hasNew && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Notifications du jour</h4>
            <span className="text-xs text-gray-400">{new Date().toLocaleDateString('fr-FR')}</span>
          </div>

          {count === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              <i className="bi bi-check-circle text-3xl mb-2 block text-green-400" />
              Aucune arrivée ni départ aujourd'hui
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {(data?.arrivals.length ?? 0) > 0 && (
                <div>
                  <p className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50 uppercase tracking-wider">
                    <i className="bi bi-airplane-engines mr-1" />Arrivées ({data?.arrivals.length})
                  </p>
                  {data?.arrivals.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => { navigate('/app/bookings'); setOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-50"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                        {a.client[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.client}</p>
                        <p className="text-xs text-gray-400">Chambre #{a.room} · {a.reference}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Check-in</span>
                    </button>
                  ))}
                </div>
              )}

              {(data?.departures.length ?? 0) > 0 && (
                <div>
                  <p className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50 uppercase tracking-wider">
                    <i className="bi bi-luggage mr-1" />Départs ({data?.departures.length})
                  </p>
                  {data?.departures.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => { navigate('/app/bookings'); setOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors text-left border-b border-gray-50"
                    >
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-700 flex-shrink-0">
                        {d.client[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{d.client}</p>
                        <p className="text-xs text-gray-400">Chambre #{d.room} · {d.reference}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">Check-out</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => { navigate('/app/bookings'); setOpen(false) }}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Voir toutes les réservations →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
