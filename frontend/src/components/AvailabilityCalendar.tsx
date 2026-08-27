import { useState, useEffect } from 'react'
import { getAvailabilityCalendar, CalendarDay } from '../api/public'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                   'Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

function dayColor(d: CalendarDay): string {
  if (d.past)            return 'bg-gray-100 text-gray-300 cursor-default'
  if (d.available === 0) return 'bg-red-50 text-red-300 cursor-default'
  if (d.available <= Math.ceil(d.total * 0.25)) return 'bg-amber-50 text-amber-600 hover:bg-amber-100 cursor-pointer'
  return 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
}

function dot(d: CalendarDay): string {
  if (d.past)            return 'bg-gray-200'
  if (d.available === 0) return 'bg-red-300'
  if (d.available <= Math.ceil(d.total * 0.25)) return 'bg-amber-400'
  return 'bg-emerald-400'
}

interface Props {
  onSelectDate?: (checkIn: string, checkOut: string) => void
}

export default function AvailabilityCalendar({ onSelectDate }: Props) {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [days,  setDays]  = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null) // first picked date

  useEffect(() => {
    setLoading(true)
    getAvailabilityCalendar(year, month)
      .then(d => setDays(d.days))
      .catch(() => {})
      .finally(() => setLoading(false))
    setSelecting(null)
  }, [year, month])

  const prev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const next = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const canPrev = !(year === today.getFullYear() && month === today.getMonth() + 1)

  const handleDayClick = (d: CalendarDay) => {
    if (d.past || d.available === 0) return
    if (!selecting) {
      setSelecting(d.date)
    } else {
      if (d.date <= selecting) { setSelecting(d.date); return }
      onSelectDate?.(selecting, d.date)
      setSelecting(null)
      // Scroll to booking form
      document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Build grid: offset for first weekday
  const firstWeekday = days[0]?.weekday ?? 0
  const blanks = Array(firstWeekday).fill(null)

  return (
    <div>
      {/* Navigation mois */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={prev}
          disabled={!canPrev}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <i className="bi bi-chevron-left" />
        </button>
        <p className="text-white font-semibold text-base">
          {MONTHS_FR[month - 1]} {year}
        </p>
        <button
          onClick={next}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <i className="bi bi-chevron-right" />
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS_FR.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grille */}
      {loading ? (
        <div className="h-48 flex items-center justify-center text-white/30">
          <i className="bi bi-arrow-repeat animate-spin text-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {blanks.map((_, i) => <div key={`b${i}`} />)}
          {days.map(d => (
            <button
              key={d.date}
              onClick={() => handleDayClick(d)}
              disabled={d.past || d.available === 0}
              title={d.past ? '' : d.available === 0 ? 'Complet' : `${d.available} chambre${d.available > 1 ? 's' : ''} disponible${d.available > 1 ? 's' : ''}`}
              className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-all duration-150 text-sm font-medium
                ${dayColor(d)}
                ${selecting === d.date ? 'ring-2 ring-hotel-gold scale-110 z-10' : ''}
              `}
            >
              <span>{d.day}</span>
              {!d.past && (
                <span className={`absolute bottom-1 w-1 h-1 rounded-full ${dot(d)}`} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Légende */}
      <div className="flex items-center justify-center gap-5 mt-5 text-xs text-white/40">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Disponible</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Dernières places</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-300 inline-block" />Complet</span>
      </div>

      {selecting && (
        <p className="text-center text-sm text-hotel-gold mt-4 animate-pulse">
          <i className="bi bi-calendar-check me-1" />
          Arrivée : {new Date(selecting + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} — cliquez sur la date de départ
        </p>
      )}
    </div>
  )
}
