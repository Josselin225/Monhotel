import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { bookingsApi, CalendarRoom } from '../api/bookings'
import { AMENITY_META, AmenityType } from '../api/amenities'
import { format, addDays, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import PageHeader from '../components/PageHeader'
import { SkeletonChart } from '../components/Skeleton'
import { getApiError } from '../utils'

const STATUS_COLORS: Record<string, string> = {
  confirmed:  'bg-blue-500',
  checked_in: 'bg-green-500',
  pending:    'bg-yellow-400',
}
const STATUS_LABELS: Record<string, string> = {
  confirmed:  'Confirmée',
  checked_in: 'En cours',
  pending:    'En attente',
}

const ROOM_STATUS_DOT: Record<string, string> = {
  available:   'bg-green-400',
  occupied:    'bg-red-400',
  cleaning:    'bg-amber-400',
  maintenance: 'bg-orange-500',
  dirty:       'bg-orange-400',
}
const ROOM_STATUS_LABEL: Record<string, string> = {
  available:   'Libre',
  occupied:    'Occupée',
  cleaning:    'Nettoyage',
  maintenance: 'Maintenance',
  dirty:       'À nettoyer',
}

interface DragState {
  bookingId: number
  roomId: number
  nights: number
  grabDayOffset: number
}

type SelectedBooking = { booking: CalendarRoom['bookings'][0]; room: CalendarRoom }

export default function PlanningPage() {
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1)
    return d
  })
  const [periodDays, setPeriodDays] = useState(14)
  const [rooms, setRooms]         = useState<CalendarRoom[]>([])
  const [loading, setLoading]     = useState(true)
  const [filterType, setFilterType] = useState<string>('all')
  const [tooltip, setTooltip]     = useState<{ booking: CalendarRoom['bookings'][0]; x: number; y: number } | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<SelectedBooking | null>(null)

  // Drag & drop
  const [dragging, setDragging]   = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<{ roomId: number; dayIdx: number } | null>(null)
  const [saving, setSaving]       = useState(false)
  const dragRef = useRef<DragState | null>(null)

  const DAYS   = periodDays
  const endDate = addDays(startDate, DAYS - 1)
  const today  = new Date()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await bookingsApi.calendar(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
      )
      setRooms(data.rooms)
    } finally { setLoading(false) }
  }, [startDate, periodDays])

  useEffect(() => { load() }, [load])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const days        = eachDayOfInterval({ start: startDate, end: endDate })
  const roomTypes   = ['all', ...Array.from(new Set(rooms.map(r => r.room_type)))]
  const filteredRooms = filterType === 'all' ? rooms : rooms.filter(r => r.room_type === filterType)

  const todayStr     = format(today, 'yyyy-MM-dd')
  const occupiedToday = rooms.filter(r =>
    r.bookings.some(b => b.check_in <= todayStr && b.check_out > todayStr && b.status !== 'cancelled')
  ).length
  const occupancyPct = rooms.length > 0 ? Math.round((occupiedToday / rooms.length) * 100) : 0

  // ── Booking geometry ────────────────────────────────────────────────────────
  const getBookingStyle = (booking: CalendarRoom['bookings'][0]) => {
    const cin  = parseISO(booking.check_in)
    const cout = parseISO(booking.check_out)
    const startOffset = Math.max(0, Math.floor((cin.getTime()  - startDate.getTime()) / 86400000))
    const endOffset   = Math.min(DAYS, Math.ceil((cout.getTime() - startDate.getTime()) / 86400000))
    const width = endOffset - startOffset
    return {
      left:  `${(startOffset / DAYS) * 100}%`,
      width: `calc(${(width / DAYS) * 100}% - 4px)`,
    }
  }

  const isVisible = (booking: CalendarRoom['bookings'][0]) => {
    const cin  = parseISO(booking.check_in)
    const cout = parseISO(booking.check_out)
    return cin < endDate && cout > startDate
  }

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, booking: CalendarRoom['bookings'][0], roomId: number) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const relX = e.clientX - rect.left
    const grabRatio = Math.max(0, Math.min(1, relX / rect.width))
    const grabDayOffset = Math.floor(grabRatio * booking.nights)

    const state: DragState = { bookingId: booking.id, roomId, nights: booking.nights, grabDayOffset }
    dragRef.current = state
    setDragging(state)
    setTooltip(null)
    setSelectedBooking(null)

    const ghost = document.createElement('div')
    ghost.style.position = 'fixed'
    ghost.style.top = '-9999px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, roomId: number, dayIdx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget({ roomId, dayIdx })
  }

  const handleDrop = async (e: React.DragEvent, roomId: number, dayIdx: number) => {
    e.preventDefault()
    const state = dragRef.current
    if (!state) return

    const newCheckInDayOffset = dayIdx - state.grabDayOffset
    const newCheckIn  = addDays(startDate, newCheckInDayOffset)
    const newCheckOut = addDays(newCheckIn, state.nights)

    const currentBooking = rooms.flatMap(r => r.bookings).find(b => b.id === state.bookingId)
    if (currentBooking) {
      const currentCin = parseISO(currentBooking.check_in)
      if (isSameDay(newCheckIn, currentCin) && roomId === state.roomId) {
        setDragging(null); setDropTarget(null); dragRef.current = null; return
      }
    }

    setSaving(true)
    try {
      await bookingsApi.update(state.bookingId, {
        check_in:  format(newCheckIn, 'yyyy-MM-dd'),
        check_out: format(newCheckOut, 'yyyy-MM-dd'),
        room: roomId,
      } as any)
      toast.success('Réservation déplacée')
      await load()
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setSaving(false); setDragging(null); setDropTarget(null); dragRef.current = null
    }
  }

  const handleDragEnd = () => {
    setDragging(null); setDropTarget(null); dragRef.current = null
  }

  const getDropPreview = () => {
    if (!dragging || !dropTarget) return null
    const newStartIdx = dropTarget.dayIdx - dragging.grabDayOffset
    const newEndIdx   = newStartIdx + dragging.nights
    return { startIdx: Math.max(0, newStartIdx), endIdx: Math.min(DAYS, newEndIdx) }
  }
  const dropPreview = getDropPreview()

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-gray-700 font-medium">
                {format(startDate, 'd MMMM', { locale: fr })} — {format(endDate, 'd MMMM yyyy', { locale: fr })}
                {saving && <span className="ml-2 text-amber-500"><i className="bi bi-arrow-repeat animate-spin mr-1" />Sauvegarde…</span>}
              </p>
            </div>
            {/* Taux d'occupation */}
            {!loading && rooms.length > 0 && (
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${occupancyPct >= 80 ? 'bg-red-400' : occupancyPct >= 50 ? 'bg-amber-400' : 'bg-green-400'}`}
                    style={{ width: `${occupancyPct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700">{occupancyPct}%</span>
                <span className="text-xs text-gray-400 hidden sm:inline">occupation</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Légende */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 mr-1">
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${STATUS_COLORS[k]}`} />
                  {v}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-gray-400">
                <i className="bi bi-arrows-move text-xs" /> Glissez pour déplacer
              </div>
            </div>

            {/* Filtre type chambre */}
            {roomTypes.length > 2 && (
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="text-sm border-b border-gray-300 bg-transparent focus:outline-none focus:border-amber-500 px-1 py-1">
                {roomTypes.map(t => (
                  <option key={t} value={t}>{t === 'all' ? 'Tous types' : t}</option>
                ))}
              </select>
            )}

            <input type="date" value={format(startDate, 'yyyy-MM-dd')}
              onChange={e => { if (e.target.value) setStartDate(new Date(e.target.value + 'T00:00:00')) }}
              className="text-sm border-b border-gray-300 bg-transparent focus:outline-none focus:border-amber-500 px-1 py-1" />
            <select value={periodDays} onChange={e => setPeriodDays(Number(e.target.value))}
              className="text-sm border-b border-gray-300 bg-transparent focus:outline-none focus:border-amber-500 px-1 py-1">
              <option value={7}>7 jours</option>
              <option value={14}>14 jours</option>
              <option value={21}>21 jours</option>
              <option value={28}>28 jours</option>
            </select>
            <button onClick={() => setStartDate(d => subWeeks(d, 1))} className="btn-secondary px-3 py-2 text-sm">← Préc.</button>
            <button onClick={() => setStartDate(() => {
              const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d
            })} className="btn-secondary px-3 py-2 text-sm">Aujourd'hui</button>
            <button onClick={() => setStartDate(d => addWeeks(d, 1))} className="btn-secondary px-3 py-2 text-sm">Suiv. →</button>
            <button onClick={() => window.print()} className="btn-secondary px-3 py-2 text-sm print:hidden">
              <i className="bi bi-printer" />
            </button>
          </div>
        </div>
      </PageHeader>

      {loading ? (
        <SkeletonChart height={400} />
      ) : (
        <div className={`card p-0 overflow-hidden overflow-x-auto select-none ${dragging ? 'cursor-grabbing' : ''}`}>
          {/* Header jours */}
          <div className="flex border-b border-gray-100 bg-gray-50 sticky top-0 z-10" style={{ minWidth: `${36 * 4 + DAYS * 40}px` }}>
            <div className="w-36 flex-shrink-0 px-4 py-3 text-xs font-medium text-gray-500 border-r border-gray-100 sticky left-0 z-20 bg-gray-50">
              Chambre
            </div>
            <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}>
              {days.map(day => {
                const isToday   = isSameDay(day, today)
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                return (
                  <div key={day.toISOString()} className={`py-2 text-center border-r border-gray-100 last:border-r-0 ${
                    isToday ? 'bg-amber-50' : isWeekend ? 'bg-gray-100/60' : ''
                  }`}>
                    <p className={`text-xs font-medium ${isToday ? 'text-amber-600' : isWeekend ? 'text-gray-400' : 'text-gray-500'}`}>
                      {format(day, 'EEE', { locale: fr })}
                    </p>
                    <p className={`text-sm font-bold ${isToday ? 'text-amber-600' : isWeekend ? 'text-gray-500' : 'text-gray-900'}`}>
                      {format(day, 'd')}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lignes chambres */}
          {filteredRooms.map(room => (
            <div key={room.room_id} className="flex border-b border-gray-50 hover:bg-gray-50/30 transition-colors" style={{ minHeight: 52, minWidth: `${36 * 4 + DAYS * 40}px` }}>
              {/* Colonne chambre — sticky */}
              <div className="w-36 flex-shrink-0 px-4 py-3 border-r border-gray-100 flex flex-col justify-center sticky left-0 z-10 bg-white">
                <div className="flex items-center gap-1.5">
                  <span
                    title={ROOM_STATUS_LABEL[room.status] || room.status}
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${ROOM_STATUS_DOT[room.status] || 'bg-gray-300'}`}
                  />
                  <p className="font-bold text-gray-900 text-sm">#{room.room_number}</p>
                </div>
                <p className="text-xs text-gray-400 ml-3.5">{room.room_type}</p>
              </div>

              {/* Timeline */}
              <div className="flex-1 relative py-2">
                {/* Zones de drop */}
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)`, zIndex: dragging ? 5 : 0 }}>
                  {days.map((day, dayIdx) => {
                    const isToday   = isSameDay(day, today)
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6
                    const isDropping = dropTarget?.roomId === room.room_id && dropTarget?.dayIdx === dayIdx
                    const isPreview  = dropPreview && dropTarget?.roomId === room.room_id &&
                      dayIdx >= dropPreview.startIdx && dayIdx < dropPreview.endIdx
                    return (
                      <div
                        key={day.toISOString()}
                        className={`border-r border-gray-100 last:border-r-0 transition-colors ${
                          isToday   ? 'bg-amber-50/40' : isWeekend ? 'bg-gray-50/70' : ''
                        } ${isPreview ? 'bg-blue-100/60' : ''} ${isDropping && dragging ? 'bg-blue-200/40' : ''}`}
                        onDragOver={dragging ? e => handleDragOver(e, room.room_id, dayIdx) : undefined}
                        onDrop={dragging ? e => handleDrop(e, room.room_id, dayIdx) : undefined}
                      />
                    )
                  })}
                </div>

                {/* Blocs réservation */}
                {room.bookings.filter(isVisible).map(booking => {
                  const style      = getBookingStyle(booking)
                  const colorClass = STATUS_COLORS[booking.status] || 'bg-gray-400'
                  const isDragged  = dragging?.bookingId === booking.id
                  return (
                    <div
                      key={booking.id}
                      draggable
                      onDragStart={e => handleDragStart(e, booking, room.room_id)}
                      onDragEnd={handleDragEnd}
                      onMouseEnter={e => !dragging && setTooltip({ booking, x: e.clientX, y: e.clientY })}
                      onMouseMove={e => tooltip && setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => { setTooltip(null); setSelectedBooking({ booking, room }) }}
                      className={`absolute top-1.5 h-8 ${colorClass} rounded-md text-white text-xs flex items-center px-2 cursor-grab active:cursor-grabbing hover:brightness-110 transition-all shadow-sm overflow-hidden ${isDragged ? 'opacity-40 scale-95' : ''}`}
                      style={{ ...style, zIndex: isDragged ? 0 : 2 }}
                    >
                      <i className="bi bi-arrows-move text-[10px] mr-1.5 opacity-60 shrink-0" />
                      <span className="truncate font-medium">{booking.client}</span>
                      {booking.amenities.length > 0 && (
                        <i className="bi bi-star-fill text-[10px] ml-1.5 shrink-0" title="A réservé un service" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {filteredRooms.length === 0 && (
            <div className="text-center py-16 text-gray-400">Aucune chambre trouvée</div>
          )}
        </div>
      )}

      {/* Tooltip hover */}
      {tooltip && !dragging && !selectedBooking && (
        <div className="fixed z-50 bg-gray-900 text-white rounded-xl p-4 shadow-2xl text-sm pointer-events-none w-64"
          style={{ left: tooltip.x + 12, top: tooltip.y - 80 }}>
          <p className="font-bold mb-1">{tooltip.booking.client}</p>
          <p className="text-gray-300 text-xs">Réf : {tooltip.booking.reference}</p>
          <div className="mt-2 space-y-1 text-xs text-gray-300">
            <p>Arrivée : {format(parseISO(tooltip.booking.check_in), 'dd/MM/yyyy')}</p>
            <p>Départ : {format(parseISO(tooltip.booking.check_out), 'dd/MM/yyyy')}</p>
            <p>{tooltip.booking.nights} nuit{tooltip.booking.nights > 1 ? 's' : ''}</p>
          </div>
          {tooltip.booking.amenities.length > 0 && (
            <p className="mt-2 text-xs text-amber-300 flex items-center gap-1">
              <i className="bi bi-star-fill" />
              {tooltip.booking.amenities.map(a => AMENITY_META[a as AmenityType]?.label ?? a).join(', ')}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[tooltip.booking.status]} text-white`}>
              {STATUS_LABELS[tooltip.booking.status] ?? tooltip.booking.status}
            </span>
            <span className="text-gray-400 text-xs"><i className="bi bi-hand-index" /> Cliquer pour détails</span>
          </div>
        </div>
      )}

      {/* Indicateur drop preview */}
      {dragging && dropTarget && dropPreview && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2 rounded-full text-sm shadow-xl">
          <i className="bi bi-calendar-arrow-right mr-2" />
          Déposer le {format(addDays(startDate, dropPreview.startIdx), 'd MMM', { locale: fr })}
          {' '}→ {format(addDays(startDate, dropPreview.endIdx), 'd MMM', { locale: fr })}
        </div>
      )}

      {/* Panneau détail réservation */}
      {selectedBooking && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelectedBooking(null)} />
          <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className={`px-5 py-4 ${STATUS_COLORS[selectedBooking.booking.status] || 'bg-gray-500'} text-white`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-lg leading-tight">{selectedBooking.booking.client}</p>
                  <p className="text-white/70 text-sm font-mono mt-0.5">{selectedBooking.booking.reference}</p>
                </div>
                <button onClick={() => setSelectedBooking(null)}
                  className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                  <i className="bi bi-x-lg text-sm" />
                </button>
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 bg-white/20 rounded-lg px-3 py-1 text-sm font-medium">
                <i className="bi bi-door-open" />
                Chambre #{selectedBooking.room.room_number} · {selectedBooking.room.room_type}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Dates */}
              <div className="card">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Dates du séjour</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-center">
                    <p className="text-xs text-gray-400 mb-1">Arrivée</p>
                    <p className="font-bold text-gray-900">{format(parseISO(selectedBooking.booking.check_in), 'dd MMM yyyy', { locale: fr })}</p>
                  </div>
                  <div className="text-gray-300">
                    <i className="bi bi-arrow-right" />
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-xs text-gray-400 mb-1">Départ</p>
                    <p className="font-bold text-gray-900">{format(parseISO(selectedBooking.booking.check_out), 'dd MMM yyyy', { locale: fr })}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                  <span className="text-sm font-semibold text-gray-700">
                    {selectedBooking.booking.nights} nuit{selectedBooking.booking.nights > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Statut */}
              <div className="card">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Statut</p>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white ${STATUS_COLORS[selectedBooking.booking.status] || 'bg-gray-500'}`}>
                  <i className="bi bi-circle-fill text-[8px]" />
                  {STATUS_LABELS[selectedBooking.booking.status] ?? selectedBooking.booking.status}
                </span>
              </div>

              {/* Services réservés */}
              {selectedBooking.booking.amenities.length > 0 && (
                <div className="card">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Services réservés</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedBooking.booking.amenities.map(a => {
                      const meta = AMENITY_META[a as AmenityType]
                      return (
                        <span key={a} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <i className={`bi ${meta?.icon ?? 'bi-star-fill'}`} />
                          {meta?.label ?? a}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Chambre */}
              <div className="card">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Chambre</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <i className="bi bi-door-closed text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">#{selectedBooking.room.room_number}</p>
                    <p className="text-sm text-gray-500">{selectedBooking.room.room_type}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${ROOM_STATUS_DOT[selectedBooking.room.status] || 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-500">{ROOM_STATUS_LABEL[selectedBooking.room.status] ?? selectedBooking.room.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100">
              <button onClick={() => setSelectedBooking(null)} className="btn-secondary w-full justify-center">
                Fermer
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
