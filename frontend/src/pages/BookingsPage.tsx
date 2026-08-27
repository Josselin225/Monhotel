import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { bookingsApi, ExtraService } from '../api/bookings'
import { clientsApi } from '../api/clients'
import { roomsApi, PriceCalculation } from '../api/rooms'
import { satisfactionApi } from '../api/satisfaction'
import { Booking, Client, Room, RoomType } from '../types'
import { BOOKING_STATUS_COLORS, formatDate, formatFcfa, getApiError } from '../utils'
import Pagination from '../components/Pagination'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'
import { useDebounce } from '../hooks/useDebounce'
import { SkeletonTablePage } from '../components/Skeleton'

const bookingSchema = z.object({
  client:          z.number().positive('Client requis'),
  room:            z.number().positive('Chambre requise'),
  billing_type:    z.enum(['nightly', 'hourly']),
  check_in:        z.string().min(1, 'Date d\'arrivée requise'),
  check_out:       z.string(),
  hours:           z.number().int().min(1).nullable(),
  adults:          z.number().min(1, 'Minimum 1 adulte'),
  children:        z.number().min(0),
  price_per_night: z.number().min(0),
  price_per_hour:  z.number().min(0).nullable(),
  deposit:         z.number().min(0),
  status:          z.string(),
  source:          z.string(),
  special_requests:z.string(),
  notes:           z.string(),
}).refine(d => d.billing_type === 'hourly' || d.check_in < d.check_out, {
  message: 'La date de départ doit être après la date d\'arrivée',
  path: ['check_out'],
}).refine(d => d.billing_type === 'nightly' || (d.hours != null && d.hours > 0), {
  message: 'Durée requise',
  path: ['hours'],
}).refine(d => d.billing_type === 'nightly' || (d.price_per_hour != null && d.price_per_hour > 0), {
  message: 'Prix à l\'heure requis',
  path: ['price_per_hour'],
})

type FormErrors = Partial<Record<keyof z.infer<typeof bookingSchema> | '_form', string>>

const EMPTY_FORM = {
  client: '', room: '', billing_type: 'nightly' as 'nightly' | 'hourly',
  check_in: '', check_out: '',
  hours: '', price_per_hour: '',
  adults: '1', children: '0', status: 'confirmed', source: 'direct',
  price_per_night: '', deposit: '0', special_requests: '', notes: '',
}

const EXTRA_CATEGORIES = [
  { value: 'food',      label: 'Restauration' },
  { value: 'transport', label: 'Transport' },
  { value: 'spa',       label: 'Spa & Bien-être' },
  { value: 'laundry',   label: 'Blanchisserie' },
  { value: 'minibar',   label: 'Minibar' },
  { value: 'phone',     label: 'Téléphone' },
  { value: 'other',     label: 'Autre' },
]

const EMPTY_EXTRA = { category: 'other', description: '', amount: '', quantity: '1', date: '' }

export default function BookingsPage() {
  const [bookings, setBookings]   = useState<Booking[]>([])
  const [clients, setClients]     = useState<Client[]>([])
  const [rooms, setRooms]         = useState<Room[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState({ status: '', search: '', check_in_after: '', check_in_before: '' })
  const debouncedSearch           = useDebounce(filter.search, 300)
  const debouncedAfter            = useDebounce(filter.check_in_after, 300)
  const debouncedBefore           = useDebounce(filter.check_in_before, 300)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Booking | null>(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [errors, setErrors]       = useState<FormErrors>({})
  const [saving, setSaving]       = useState(false)
  const [priceInfo, setPriceInfo] = useState<PriceCalculation | null>(null)
  const calcAbort = useRef<AbortController | null>(null)

  // Extras
  const [extrasBooking, setExtrasBooking] = useState<Booking | null>(null)
  const [extras, setExtras]               = useState<ExtraService[]>([])
  const [extrasLoading, setExtrasLoading] = useState(false)
  const [showExtraForm, setShowExtraForm] = useState(false)
  const [extraForm, setExtraForm]         = useState(EMPTY_EXTRA)
  const [savingExtra, setSavingExtra]     = useState(false)

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page) }
      if (filter.status)    params.status = filter.status
      if (debouncedSearch)  params.search = debouncedSearch
      if (debouncedAfter)   params.check_in_after  = debouncedAfter
      if (debouncedBefore)  params.check_in_before = debouncedBefore
      const [b, c, r, rt] = await Promise.all([
        bookingsApi.list(params),
        clientsApi.list({ page_size: '200' }),
        roomsApi.list({ page_size: '200' }),
        roomsApi.listTypes(),
      ])
      setBookings(b.results)
      setTotal(b.count)
      setClients(c.results)
      setRooms(r.results)
      setRoomTypes(rt.results)
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [filter.status, debouncedSearch, debouncedAfter, debouncedBefore, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [filter.status, debouncedSearch, debouncedAfter, debouncedBefore])

  useEffect(() => {
    if (!showModal || !form.room || !form.check_in || !form.check_out) {
      setPriceInfo(null)
      return
    }
    if (calcAbort.current) calcAbort.current.abort()
    const ctrl = new AbortController()
    calcAbort.current = ctrl
    roomsApi.calculatePrice(Number(form.room), form.check_in, form.check_out)
      .then(info => {
        if (!ctrl.signal.aborted) {
          setPriceInfo(info)
          setForm(f => ({ ...f, price_per_night: String(info.price_per_night) }))
        }
      })
      .catch(() => {})
  }, [form.room, form.check_in, form.check_out, showModal])

  // Load extras when panel opens
  useEffect(() => {
    if (!extrasBooking) return
    setExtrasLoading(true)
    bookingsApi.listExtras(extrasBooking.id)
      .then(setExtras)
      .catch(() => toast.error('Impossible de charger les extras'))
      .finally(() => setExtrasLoading(false))
  }, [extrasBooking])

  const openCreate = () => {
    setEditing(null); setForm(EMPTY_FORM); setErrors({}); setPriceInfo(null); setShowModal(true)
  }
  const openEdit = (b: Booking) => {
    setEditing(b)
    setForm({
      client: String(b.client), room: String(b.room),
      billing_type: b.billing_type ?? 'nightly',
      check_in: b.check_in, check_out: b.check_out,
      hours: b.hours != null ? String(b.hours) : '',
      price_per_hour: b.price_per_hour != null ? String(b.price_per_hour) : '',
      adults: String(b.adults), children: String(b.children),
      status: b.status, source: b.source,
      price_per_night: String(b.price_per_night),
      deposit: String(b.deposit),
      special_requests: b.special_requests, notes: b.notes,
    })
    setErrors({})
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const isHourly = form.billing_type === 'hourly'
    const parsed = bookingSchema.safeParse({
      client: Number(form.client), room: Number(form.room),
      billing_type: form.billing_type,
      check_in: form.check_in,
      check_out: isHourly ? form.check_in : form.check_out,
      hours:         isHourly ? (Number(form.hours) || null) : null,
      price_per_night: Number(form.price_per_night) || 0,
      price_per_hour: isHourly ? (Number(form.price_per_hour) || null) : null,
      adults: Number(form.adults), children: Number(form.children),
      status: form.status, source: form.source,
      deposit: Number(form.deposit),
      special_requests: form.special_requests, notes: form.notes,
    })
    if (!parsed.success) {
      const errs: FormErrors = {}
      parsed.error.issues.forEach((e: z.ZodIssue) => { if (e.path[0]) errs[e.path[0] as keyof FormErrors] = e.message })
      setErrors(errs); return
    }
    setSaving(true)
    try {
      if (editing) {
        await bookingsApi.update(editing.id, parsed.data as Partial<Booking>)
        toast.success('Réservation mise à jour')
      } else {
        await bookingsApi.create(parsed.data as Partial<Booking>)
        toast.success('Réservation créée')
      }
      setShowModal(false); load()
    } catch (err) {
      const msg = getApiError(err)
      if (msg.includes('room:')) setErrors({ room: msg.replace('room: ', '') })
      else toast.error(msg)
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette réservation ?')) return
    try {
      await bookingsApi.delete(id); toast.success('Réservation supprimée'); load()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const handleCheckIn  = async (id: number) => { try { await bookingsApi.checkIn(id);  toast.success('Check-in effectué ✓');  load() } catch (err) { toast.error(getApiError(err)) } }
  const handleCheckOut = async (id: number) => { try { await bookingsApi.checkOut(id); toast.success('Check-out effectué ✓'); load() } catch (err) { toast.error(getApiError(err)) } }
  const handlePayDeposit = async (id: number) => { try { await bookingsApi.payDeposit(id); toast.success('Acompte encaissé ✓'); load() } catch (err) { toast.error(getApiError(err)) } }

  const handleSendSurvey = async (bookingId: number) => {
    try {
      const survey = await satisfactionApi.create(bookingId)
      await satisfactionApi.sendSurvey(survey.id)
      toast.success('Questionnaire envoyé ✓')
    } catch (err) { toast.error(getApiError(err)) }
  }

  const selectedRoomType = (() => {
    const room = rooms.find(r => String(r.id) === form.room)
    return room ? roomTypes.find(t => t.id === room.room_type) ?? null : null
  })()

  const onRoomSelect = (roomId: string) => {
    const room = rooms.find(r => String(r.id) === roomId)
    const rt   = room ? roomTypes.find(t => t.id === room.room_type) : null
    const isHourlyType = rt?.hourly_rate != null
    setForm(f => ({
      ...f, room: roomId,
      billing_type:    isHourlyType ? 'hourly' : 'nightly',
      price_per_night: !isHourlyType && room ? String(room.price) : '0',
      price_per_hour:  isHourlyType && rt?.hourly_rate != null ? String(rt.hourly_rate) : '',
    }))
    if (errors.room) setErrors({ ...errors, room: undefined })
  }

  const handleExportCsv = async () => {
    try {
      const blob = await bookingsApi.exportCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'reservations.csv'; a.click()
      URL.revokeObjectURL(url)
      toast.success('Export téléchargé')
    } catch { toast.error('Erreur lors de l\'export') }
  }

  const handleExportXlsx = async () => {
    try {
      const blob = await bookingsApi.exportXlsx()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'reservations.xlsx'; a.click()
      URL.revokeObjectURL(url)
      toast.success('Export Excel téléchargé')
    } catch { toast.error('Erreur lors de l\'export Excel') }
  }

  // ── Extras handlers ──────────────────────────────────────────
  const handleAddExtra = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!extrasBooking) return
    setSavingExtra(true)
    try {
      const newExtra = await bookingsApi.addExtra(extrasBooking.id, {
        category: extraForm.category,
        description: extraForm.description,
        amount: extraForm.amount as unknown as string,
        quantity: Number(extraForm.quantity),
        date: extraForm.date,
      })
      setExtras(prev => [...prev, newExtra])
      setExtraForm(EMPTY_EXTRA)
      setShowExtraForm(false)
      toast.success('Extra ajouté')
    } catch (err) { toast.error(getApiError(err)) }
    finally { setSavingExtra(false) }
  }

  const handleDeleteExtra = async (extraId: number) => {
    if (!extrasBooking || !confirm('Supprimer cet extra ?')) return
    try {
      await bookingsApi.deleteExtra(extrasBooking.id, extraId)
      setExtras(prev => prev.filter(e => e.id !== extraId))
      toast.success('Extra supprimé')
    } catch (err) { toast.error(getApiError(err)) }
  }

  const extrasTotal = extras.reduce((s, e) => s + Number(e.total), 0)

  // ── Bulk action handlers ─────────────────────────────────────
  const allSelected = bookings.length > 0 && bookings.every(b => selectedIds.has(b.id))
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(bookings.map(b => b.id)))
  }
  const toggleOne = (id: number) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const handleBulkAction = async (action: string) => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    if (action === 'delete' && !confirm(`Supprimer ${ids.length} réservation(s) ?`)) return
    setBulkLoading(true)
    try {
      const result = await bookingsApi.bulkAction(ids, action)
      if (action === 'export' && result instanceof Blob) {
        const url = URL.createObjectURL(result)
        const a = document.createElement('a'); a.href = url; a.download = 'reservations_selection.csv'; a.click()
        URL.revokeObjectURL(url)
        toast.success('Export téléchargé')
      } else {
        const { count } = result as { count: number }
        toast.success(`${count} réservation(s) mise(s) à jour`)
        load()
      }
    } catch (err) { toast.error(getApiError(err)) }
    finally { setBulkLoading(false) }
  }

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700 font-medium">{total} réservation{total > 1 ? 's' : ''}</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExportCsv} className="btn-secondary flex items-center gap-2 text-sm">
              <i className="bi bi-download" /> <span className="hidden sm:inline">Export</span> CSV
            </button>
            <button onClick={handleExportXlsx} className="btn-secondary flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-800">
              <i className="bi bi-file-earmark-excel" /> <span className="hidden sm:inline">Export</span> Excel
            </button>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
              <i className="bi bi-plus-lg" /> <span className="hidden sm:inline">Nouvelle</span> réservation
            </button>
          </div>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="card mb-4 flex flex-col sm:flex-row gap-3 py-3 items-stretch sm:items-center">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <i className="bi bi-search text-gray-400" />
          <input type="text" placeholder="Référence, client, chambre…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
            value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} />
          {filter.search && <button onClick={() => setFilter({...filter, search: ''})} className="text-gray-400 hover:text-gray-600"><i className="bi bi-x" /></button>}
        </div>
        <select className="input-box w-full sm:w-44" value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirmée</option>
          <option value="checked_in">En cours</option>
          <option value="checked_out">Terminée</option>
          <option value="cancelled">Annulée</option>
          <option value="no_show">No show</option>
        </select>
        <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
          <i className="bi bi-calendar-event text-gray-400 text-sm" />
          <input
            type="date"
            title="Arrivée à partir du"
            className="input-box w-36 text-sm py-1.5"
            value={filter.check_in_after}
            onChange={e => setFilter({ ...filter, check_in_after: e.target.value })}
          />
          <span className="text-gray-400 text-xs">→</span>
          <input
            type="date"
            title="Arrivée jusqu'au"
            className="input-box w-36 text-sm py-1.5"
            value={filter.check_in_before}
            onChange={e => setFilter({ ...filter, check_in_before: e.target.value })}
          />
          {(filter.check_in_after || filter.check_in_before) && (
            <button
              onClick={() => setFilter({ ...filter, check_in_after: '', check_in_before: '' })}
              className="text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center"
              title="Effacer les dates"
            >
              <i className="bi bi-x text-sm" />
            </button>
          )}
        </div>
        <div className="flex gap-1 border-l border-gray-200 pl-3 ml-1">
          <button onClick={() => setViewMode('list')} title="Vue liste"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-amber-100 text-amber-700' : 'text-gray-400 hover:bg-gray-100'}`}>
            <i className="bi bi-list-ul text-sm" />
          </button>
          <button onClick={() => setViewMode('grid')} title="Vue grille"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-amber-100 text-amber-700' : 'text-gray-400 hover:bg-gray-100'}`}>
            <i className="bi bi-grid text-sm" />
          </button>
        </div>
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-amber-800">
            <i className="bi bi-check2-square me-1" />{selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <button onClick={() => handleBulkAction('confirm')} disabled={bulkLoading} className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium transition-colors">
              <i className="bi bi-check-circle me-1" />Confirmer
            </button>
            <button onClick={() => handleBulkAction('cancel')} disabled={bulkLoading} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors">
              <i className="bi bi-x-circle me-1" />Annuler
            </button>
            <button onClick={() => handleBulkAction('export')} disabled={bulkLoading} className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium transition-colors">
              <i className="bi bi-download me-1" />Exporter
            </button>
            <button onClick={() => handleBulkAction('delete')} disabled={bulkLoading} className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium transition-colors">
              <i className="bi bi-trash me-1" />Supprimer
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700 transition-colors">
              Désélectionner
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonTablePage cardCount={0} rows={10} cols={7} withToolbar={false} />
      ) : viewMode === 'list' ? (
        <div className="card p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[950px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="rounded border-gray-300 text-amber-500 focus:ring-amber-400 cursor-pointer" />
                </th>
                {['Réf.','Client','Chambre','Arrivée','Départ','Nuits','Total','Statut','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.map(b => (
                <tr key={b.id} className={`hover:bg-gray-50/60 transition-colors ${selectedIds.has(b.id) ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleOne(b.id)}
                      className="rounded border-gray-300 text-amber-500 focus:ring-amber-400 cursor-pointer" />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.reference}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{b.client_detail?.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    #{b.room_detail?.number} <span className="text-xs text-gray-400">({b.room_detail?.room_type_name})</span>
                    {b.billing_type === 'hourly' && <span className="ml-1 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-1">passage</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(b.check_in)}</td>
                  <td className="px-4 py-3 text-gray-600">{b.billing_type === 'hourly' ? '—' : formatDate(b.check_out)}</td>
                  <td className="px-4 py-3 text-gray-600">{b.duration_label ?? b.nights}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{formatFcfa(Number(b.total_price))}</p>
                    {Number(b.deposit) > 0 && (
                      <p className={`text-xs mt-0.5 flex items-center gap-1 ${b.deposit_paid ? 'text-green-600' : 'text-amber-600'}`}>
                        <i className={`bi bi-${b.deposit_paid ? 'check-circle-fill' : (b.payment_method === 'transfer' ? 'bank2' : 'clock')}`} />
                        {b.payment_method === 'transfer' ? 'Virement' : 'Acompte'} {b.deposit_paid ? '' : 'à confirmer '}{formatFcfa(Number(b.deposit))}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge border ${BOOKING_STATUS_COLORS[b.status]}`}>{b.status_display}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {Number(b.deposit) > 0 && !b.deposit_paid && ['pending', 'confirmed'].includes(b.status) && (
                        <button onClick={() => handlePayDeposit(b.id)} className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-medium">
                          <i className={`bi bi-${b.payment_method === 'transfer' ? 'bank2' : 'cash-coin'} me-1`} />{b.payment_method === 'transfer' ? 'Virement' : 'Acompte'}
                        </button>
                      )}
                      {b.status === 'confirmed'    && <button onClick={() => handleCheckIn(b.id)}    className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium">Check-in</button>}
                      {b.status === 'checked_in'  && <button onClick={() => handleCheckOut(b.id)}   className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium">Check-out</button>}
                      {b.status === 'checked_out' && b.client_detail?.email && (
                        <button onClick={() => handleSendSurvey(b.id)} title="Questionnaire satisfaction" className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium">
                          <i className="bi bi-emoji-smile" />
                        </button>
                      )}
                      <button onClick={() => { setExtrasBooking(b); setShowExtraForm(false); setExtraForm(EMPTY_EXTRA) }}
                        title="Extras & services" className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium">
                        <i className="bi bi-bag-plus" />
                      </button>
                      <button onClick={() => openEdit(b)}        className="btn-secondary text-xs px-2 py-1"><i className="bi bi-pencil" /></button>
                      <button onClick={() => handleDelete(b.id)} className="btn-danger text-xs px-2 py-1"><i className="bi bi-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-16 text-center text-gray-400">
                  <i className="bi bi-inbox text-3xl block mb-2 opacity-40" />
                  Aucune réservation trouvée
                </td></tr>
              )}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={page} total={total} onChange={setPage} />
          </div>
        </div>
      ) : (
        <div>
          {bookings.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
              <i className="bi bi-inbox text-3xl block mb-2 opacity-40" />
              Aucune réservation trouvée
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {bookings.map(b => (
                <div key={b.id} className={`card relative flex flex-col gap-3 ${selectedIds.has(b.id) ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}>
                  {/* Checkbox + statut */}
                  <div className="flex items-start justify-between gap-2">
                    <input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleOne(b.id)}
                      className="mt-0.5 rounded border-gray-300 text-amber-500 focus:ring-amber-400 cursor-pointer" />
                    <span className={`badge border text-xs ${BOOKING_STATUS_COLORS[b.status]}`}>{b.status_display}</span>
                  </div>

                  {/* Référence + client */}
                  <div>
                    <p className="font-mono text-xs text-gray-400">{b.reference}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {b.client_detail?.full_name?.charAt(0) ?? '?'}
                      </div>
                      <p className="font-semibold text-gray-900 text-sm truncate">{b.client_detail?.full_name}</p>
                    </div>
                  </div>

                  {/* Chambre */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <i className="bi bi-door-closed text-gray-400" />
                    <span>#{b.room_detail?.number} · {b.room_detail?.room_type_name}</span>
                    {b.billing_type === 'hourly' && <span className="text-amber-600 bg-amber-50 border border-amber-100 rounded px-1">passage</span>}
                  </div>

                  {/* Dates */}
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <i className="bi bi-box-arrow-in-right text-green-500" />
                      {formatDate(b.check_in)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <i className="bi bi-box-arrow-right text-orange-400" />
                      {b.billing_type === 'hourly' ? '—' : formatDate(b.check_out)}
                    </div>
                    <p className="text-gray-400 pl-5">{b.duration_label ?? `${b.nights} nuit${b.nights > 1 ? 's' : ''}`}</p>
                  </div>

                  {/* Prix */}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="font-bold text-gray-900">{formatFcfa(Number(b.total_price))}</p>
                    {Number(b.deposit) > 0 && (
                      <p className={`text-xs mt-0.5 flex items-center gap-1 ${b.deposit_paid ? 'text-green-600' : 'text-amber-600'}`}>
                        <i className={`bi bi-${b.deposit_paid ? 'check-circle-fill' : (b.payment_method === 'transfer' ? 'bank2' : 'clock')}`} />
                        {b.payment_method === 'transfer' ? 'Virement' : 'Acompte'} {b.deposit_paid ? '' : 'à confirmer '}{formatFcfa(Number(b.deposit))}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 flex-wrap pt-1">
                    {Number(b.deposit) > 0 && !b.deposit_paid && ['pending', 'confirmed'].includes(b.status) && (
                      <button onClick={() => handlePayDeposit(b.id)} className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-medium">
                        <i className="bi bi-cash-coin me-1" />Acompte
                      </button>
                    )}
                    {b.status === 'confirmed'   && <button onClick={() => handleCheckIn(b.id)}  className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium">Check-in</button>}
                    {b.status === 'checked_in'  && <button onClick={() => handleCheckOut(b.id)} className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium">Check-out</button>}
                    {b.status === 'checked_out' && b.client_detail?.email && (
                      <button onClick={() => handleSendSurvey(b.id)} title="Questionnaire satisfaction" className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium">
                        <i className="bi bi-emoji-smile" />
                      </button>
                    )}
                    <button onClick={() => { setExtrasBooking(b); setShowExtraForm(false); setExtraForm(EMPTY_EXTRA) }}
                      title="Extras" className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium">
                      <i className="bi bi-bag-plus" />
                    </button>
                    <button onClick={() => openEdit(b)}        className="btn-secondary text-xs px-2 py-1"><i className="bi bi-pencil" /></button>
                    <button onClick={() => handleDelete(b.id)} className="btn-danger text-xs px-2 py-1"><i className="bi bi-trash" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Pagination page={page} total={total} onChange={setPage} />
          </div>
        </div>
      )}

      {/* ── Booking form modal ─────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box max-w-2xl">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <i className="bi bi-calendar-check text-amber-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{editing ? `Réservation ${editing.reference}` : 'Nouvelle réservation'}</h3>
                  <p className="text-xs text-gray-400">{editing ? 'Modifier les détails' : 'Remplissez les informations'}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {errors._form && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <i className="bi bi-exclamation-triangle-fill" /> {errors._form}
                </div>
              )}

              <div>
                <p className="form-section mb-3">Séjour</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Client" icon="bi-person-fill" error={errors.client} required>
                    <select value={form.client} onChange={e => { setForm({...form, client: e.target.value}); setErrors({...errors, client: undefined}) }} className="appearance-none">
                      <option value="">Sélectionner un client…</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.is_blacklisted ? '🚫 ' : ''}{c.full_name} — {c.phone}</option>)}
                    </select>
                  </FormField>
                  {form.client && clients.find(c => String(c.id) === form.client)?.is_blacklisted && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mt-2">
                      <i className="bi bi-slash-circle-fill mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">Client en liste noire</p>
                        <p className="text-xs mt-0.5">{clients.find(c => String(c.id) === form.client)?.blacklist_reason || 'Aucun motif renseigné'}</p>
                      </div>
                    </div>
                  )}
                  <FormField label="Chambre" icon="bi-door-closed" error={errors.room} required>
                    <select value={form.room} onChange={e => onRoomSelect(e.target.value)} className="appearance-none">
                      <option value="">Sélectionner une chambre…</option>
                      {rooms.map(r => {
                        const rt = roomTypes.find(t => t.id === r.room_type)
                        const label = rt?.hourly_rate != null
                          ? `#${r.number} — ${r.room_type_name} · ⏱ ${formatFcfa(Number(rt.hourly_rate))}/h`
                          : `#${r.number} — ${r.room_type_name} (${r.status_display})`
                        return <option key={r.id} value={r.id}>{label}</option>
                      })}
                    </select>
                  </FormField>
                </div>
                {/* Badge indicateur de facturation automatique */}
                {form.billing_type === 'hourly' && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 w-fit">
                    <i className="bi bi-clock-fill" /> Chambre de passage — facturation à l'heure
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <FormField label="Date d'arrivée" icon="bi-calendar-event" error={errors.check_in} required>
                    <input type="date" value={form.check_in} onChange={e => { setForm({...form, check_in: e.target.value}); setErrors({...errors, check_in: undefined}) }} />
                  </FormField>
                  {form.billing_type === 'nightly' ? (
                    <FormField label="Date de départ" icon="bi-calendar-event" error={errors.check_out} required>
                      <input type="date" value={form.check_out} onChange={e => { setForm({...form, check_out: e.target.value}); setErrors({...errors, check_out: undefined}) }} />
                    </FormField>
                  ) : (
                    <FormField label="Durée (heures)" icon="bi-clock" error={errors.hours} required>
                      <input type="number" min="1" max="24" value={form.hours} onChange={e => { setForm({...form, hours: e.target.value}); setErrors({...errors, hours: undefined}) }} placeholder="3" />
                    </FormField>
                  )}
                </div>
              </div>

              <div>
                <p className="form-section mb-3">Occupants & Tarif</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField label="Adultes" icon="bi-person">
                    <input type="number" min="1" value={form.adults} onChange={e => setForm({...form, adults: e.target.value})} />
                  </FormField>
                  <FormField label="Enfants" icon="bi-person-fill">
                    <input type="number" min="0" value={form.children} onChange={e => setForm({...form, children: e.target.value})} />
                  </FormField>
                  {form.billing_type === 'hourly' ? (
                    <FormField label="Prix / heure (FCFA)" icon="bi-clock-history" error={errors.price_per_hour} required>
                      <input type="number" value={form.price_per_hour} onChange={e => { setForm({...form, price_per_hour: e.target.value}); setErrors({...errors, price_per_hour: undefined}) }} placeholder="0" />
                    </FormField>
                  ) : (
                    <FormField
                      label="Prix / nuit (FCFA)"
                      icon="bi-cash-coin"
                      error={errors.price_per_night}
                      required
                      hint={
                        priceInfo
                          ? priceInfo.applied_rules.length > 0
                            ? `Règles appliquées : ${priceInfo.applied_rules.join(', ')}`
                            : 'Prix de base (aucune règle applicable)'
                          : undefined
                      }
                    >
                      <input type="number" value={form.price_per_night} onChange={e => { setForm({...form, price_per_night: e.target.value}); setErrors({...errors, price_per_night: undefined}) }} placeholder="0" />
                    </FormField>
                  )}
                </div>
              </div>

              <div>
                <p className="form-section mb-3">Gestion</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField label="Statut" icon="bi-bookmark">
                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="appearance-none">
                      <option value="pending">En attente</option>
                      <option value="confirmed">Confirmée</option>
                      <option value="cancelled">Annulée</option>
                    </select>
                  </FormField>
                  <FormField label="Source" icon="bi-globe">
                    <select value={form.source} onChange={e => setForm({...form, source: e.target.value})} className="appearance-none">
                      <option value="direct">Direct</option>
                      <option value="phone">Téléphone</option>
                      <option value="online">En ligne</option>
                      <option value="agency">Agence</option>
                    </select>
                  </FormField>
                  <FormField label="Acompte (FCFA)" icon="bi-credit-card">
                    <input type="number" min="0" value={form.deposit} onChange={e => setForm({...form, deposit: e.target.value})} placeholder="0" />
                  </FormField>
                </div>
                <div className="mt-3">
                  <FormField label="Demandes spéciales" icon="bi-chat-left-dots">
                    <textarea value={form.special_requests} onChange={e => setForm({...form, special_requests: e.target.value})}
                      placeholder="Chambre calme, lit bébé, régime alimentaire…" rows={2}
                      className="block w-full bg-transparent border-0 border-b-2 border-gray-200 pl-9 pr-0 py-2.5 text-sm focus:outline-none focus:ring-0 focus:border-amber-500 placeholder:text-gray-400 resize-none" />
                  </FormField>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary min-w-[140px] justify-center">
                  {saving ? <><i className="bi bi-arrow-repeat animate-spin" /> Enregistrement…</> : <><i className={`bi ${editing ? 'bi-check-lg' : 'bi-plus-lg'}`} />{editing ? 'Enregistrer' : 'Créer la réservation'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Extras side panel ─────────────────────────────────── */}
      {extrasBooking && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={() => setExtrasBooking(null)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-gray-100">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <i className="bi bi-bag-plus text-indigo-600 text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">Extras & services</h3>
                <p className="text-xs text-gray-400 truncate">Rés. {extrasBooking.reference} — {extrasBooking.client_detail?.full_name}</p>
              </div>
              <button onClick={() => setExtrasBooking(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            {/* Summary bar */}
            <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between text-sm">
              <span className="text-indigo-700 font-medium">{extras.length} extra{extras.length > 1 ? 's' : ''}</span>
              <span className="font-bold text-indigo-900">{formatFcfa(extrasTotal)}</span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {extrasLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                  <i className="bi bi-arrow-repeat animate-spin" /> Chargement…
                </div>
              ) : extras.length === 0 && !showExtraForm ? (
                <div className="text-center py-12 text-gray-400">
                  <i className="bi bi-bag text-3xl block mb-2 opacity-30" />
                  <p className="text-sm">Aucun extra pour cette réservation</p>
                </div>
              ) : (
                extras.map(ex => (
                  <div key={ex.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{ex.description}</p>
                      <p className="text-xs text-gray-400">{ex.category_display} · {formatDate(ex.date)} · qté {ex.quantity}</p>
                    </div>
                    <p className="font-semibold text-gray-700 shrink-0">{formatFcfa(Number(ex.total))}</p>
                    <button onClick={() => handleDeleteExtra(ex.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 shrink-0">
                      <i className="bi bi-trash text-xs" />
                    </button>
                  </div>
                ))
              )}

              {/* Add extra form */}
              {showExtraForm && (
                <form onSubmit={handleAddExtra} className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Nouvel extra</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie</label>
                      <select value={extraForm.category} onChange={e => setExtraForm({...extraForm, category: e.target.value})}
                        className="w-full input-box text-sm py-2">
                        {EXTRA_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                      <input type="text" required placeholder="Ex: Petit-déjeuner x2"
                        value={extraForm.description} onChange={e => setExtraForm({...extraForm, description: e.target.value})}
                        className="w-full input-box text-sm py-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Montant (FCFA)</label>
                      <input type="number" required min="0" placeholder="0"
                        value={extraForm.amount} onChange={e => setExtraForm({...extraForm, amount: e.target.value})}
                        className="w-full input-box text-sm py-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Quantité</label>
                      <input type="number" required min="1"
                        value={extraForm.quantity} onChange={e => setExtraForm({...extraForm, quantity: e.target.value})}
                        className="w-full input-box text-sm py-2" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                      <input type="date" required
                        value={extraForm.date} onChange={e => setExtraForm({...extraForm, date: e.target.value})}
                        className="w-full input-box text-sm py-2" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setShowExtraForm(false)} className="btn-secondary text-xs py-1.5 flex-1">Annuler</button>
                    <button type="submit" disabled={savingExtra} className="btn-primary text-xs py-1.5 flex-1 justify-center">
                      {savingExtra ? <i className="bi bi-arrow-repeat animate-spin" /> : 'Ajouter'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            {!showExtraForm && (
              <div className="p-5 border-t border-gray-100">
                <button onClick={() => setShowExtraForm(true)}
                  className="btn-primary w-full justify-center text-sm">
                  <i className="bi bi-plus-lg me-2" />Ajouter un extra
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
