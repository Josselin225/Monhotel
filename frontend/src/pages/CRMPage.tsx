import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { clientsApi } from '../api/clients'
import { Client, ClientNote, CRMStats } from '../types'
import { getApiError, formatFcfa, formatDate } from '../utils'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { useDebounce } from '../hooks/useDebounce'
import { SkeletonTableRow } from '../components/Skeleton'

// ── Réglages d'affichage de la page (par utilisateur, mémorisés localement) ────

interface CrmDisplaySettings {
  topClientsLimit: number
  birthdaysLimit: number
  birthdaysDays: number
  pageSize: number
}
const CRM_SETTINGS_DEFAULTS: CrmDisplaySettings = {
  topClientsLimit: 10,
  birthdaysLimit: 5,
  birthdaysDays: 30,
  pageSize: 20,
}
function crmSettingsKey(username: string) {
  return `mh_crm_settings_${username}`
}
function loadCrmSettings(username: string): CrmDisplaySettings {
  try {
    return { ...CRM_SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem(crmSettingsKey(username)) ?? '{}') }
  } catch {
    return CRM_SETTINGS_DEFAULTS
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const VIP_STYLES: Record<string, string> = {
  regular: 'bg-gray-100 text-gray-500 border-gray-200',
  vip:     'bg-amber-50 text-amber-700 border-amber-300',
  vvip:    'bg-yellow-50 text-yellow-800 border-yellow-400',
}
const VIP_ICONS: Record<string, string> = {
  regular: 'bi-person',
  vip:     'bi-star-fill',
  vvip:    'bi-gem',
}

const NOTE_STYLES: Record<string, string> = {
  note:      'bg-gray-100  text-gray-600  border-gray-200',
  call:      'bg-blue-100  text-blue-700  border-blue-200',
  email:     'bg-indigo-100 text-indigo-700 border-indigo-200',
  complaint: 'bg-red-100   text-red-700   border-red-200',
  request:   'bg-purple-100 text-purple-700 border-purple-200',
  visit:     'bg-green-100 text-green-700  border-green-200',
}
const NOTE_ICONS: Record<string, string> = {
  note:      'bi-journal-text',
  call:      'bi-telephone',
  email:     'bi-envelope',
  complaint: 'bi-exclamation-triangle',
  request:   'bi-hand-index',
  visit:     'bi-house-door',
}
const NOTE_OPTIONS = [
  { value: 'note',      label: 'Note interne' },
  { value: 'call',      label: 'Appel téléphonique' },
  { value: 'email',     label: 'Email' },
  { value: 'complaint', label: 'Réclamation' },
  { value: 'request',   label: 'Demande spéciale' },
  { value: 'visit',     label: 'Visite / Séjour' },
]

// ── Client detail panel ────────────────────────────────────────────────────────

function ClientPanel({ client, onClose, onUpdate }: {
  client: Client
  onClose: () => void
  onUpdate: (c: Client) => void
}) {
  const [notes, setNotes]           = useState<ClientNote[]>([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [noteType, setNoteType]     = useState('note')
  const [noteContent, setNoteContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [editingVip, setEditingVip] = useState(false)
  const [vipValue, setVipValue]     = useState(client.vip_status)

  const loadNotes = useCallback(async () => {
    setLoadingNotes(true)
    try { setNotes(await clientsApi.listNotes(client.id)) }
    catch (err) { toast.error(getApiError(err)) }
    finally { setLoadingNotes(false) }
  }, [client.id])

  useEffect(() => { loadNotes() }, [loadNotes])

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim()) return
    setAddingNote(true)
    try {
      const note = await clientsApi.createNote(client.id, { note_type: noteType, content: noteContent })
      setNotes(n => [note, ...n])
      setNoteContent('')
      toast.success('Note ajoutée')
    } catch (err) { toast.error(getApiError(err))
    } finally { setAddingNote(false) }
  }

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('Supprimer cette note ?')) return
    try {
      await clientsApi.deleteNote(client.id, noteId)
      setNotes(n => n.filter(x => x.id !== noteId))
      toast.success('Note supprimée')
    } catch (err) { toast.error(getApiError(err)) }
  }

  const handleSaveVip = async () => {
    try {
      const updated = await clientsApi.update(client.id, { vip_status: vipValue })
      onUpdate(updated)
      setEditingVip(false)
      toast.success('Statut VIP mis à jour')
    } catch (err) { toast.error(getApiError(err)) }
  }

  const initials = `${client.first_name?.[0] ?? ''}${client.last_name?.[0] ?? ''}`

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1a1208] to-[#2d1f0a] p-6 text-white shrink-0">
          <div className="flex items-start justify-between mb-4">
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <i className="bi bi-x-lg text-sm" />
            </button>
            <div className="flex gap-2">
              {editingVip ? (
                <>
                  <select value={vipValue} onChange={e => setVipValue(e.target.value as Client['vip_status'])}
                    className="text-xs bg-white/10 border-b border-white/30 text-white px-2 py-1">
                    <option value="regular">Régulier</option>
                    <option value="vip">VIP</option>
                    <option value="vvip">VVIP</option>
                  </select>
                  <button onClick={handleSaveVip} className="text-xs bg-amber-500 hover:bg-amber-400 text-white px-3 py-1 rounded-lg transition-colors">
                    Sauvegarder
                  </button>
                  <button onClick={() => { setEditingVip(false); setVipValue(client.vip_status) }}
                    className="text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg transition-colors">
                    ✕
                  </button>
                </>
              ) : (
                <button onClick={() => setEditingVip(true)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-semibold ${VIP_STYLES[client.vip_status]} bg-opacity-90`}>
                  <i className={`bi ${VIP_ICONS[client.vip_status]} text-[11px]`} />
                  {client.vip_status_display}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-hotel-gold/20 border border-hotel-gold/40 flex items-center justify-center text-hotel-gold text-2xl font-bold">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold">{client.full_name}</h2>
              <p className="text-white/60 text-sm mt-0.5">{client.email || client.phone}</p>
              {client.nationality && <p className="text-white/40 text-xs mt-0.5">{client.nationality}</p>}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Séjours', val: client.bookings_count, icon: 'bi-bookmark-check' },
              { label: 'Nuits',   val: client.total_nights,   icon: 'bi-moon-stars' },
              { label: 'Valeur',  val: formatFcfa(client.lifetime_value), icon: 'bi-cash-stack' },
            ].map(s => (
              <div key={s.label} className="bg-white/8 rounded-xl p-3 text-center">
                <i className={`bi ${s.icon} text-hotel-gold text-base block mb-1`} />
                <p className="text-white font-bold text-sm leading-tight">{s.val}</p>
                <p className="text-white/40 text-[10px]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Info */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Informations</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Téléphone',   val: client.phone || '—',          icon: 'bi-telephone' },
                { label: 'Email',        val: client.email || '—',          icon: 'bi-envelope' },
                { label: 'Dernier séjour', val: formatDate(client.last_stay_date), icon: 'bi-calendar-check' },
                { label: 'Client depuis', val: formatDate(client.created_at), icon: 'bi-person-plus' },
                { label: 'Anniversaire', val: client.birthday ? formatDate(client.birthday) : '—', icon: 'bi-cake2' },
                { label: 'Pièce',       val: client.id_number || '—',      icon: 'bi-card-text' },
              ].map(f => (
                <div key={f.label} className="flex items-start gap-2">
                  <i className={`bi ${f.icon} text-gray-400 text-sm mt-0.5 shrink-0`} />
                  <div>
                    <p className="text-[10px] text-gray-400">{f.label}</p>
                    <p className="text-gray-800 font-medium text-xs leading-tight break-all">{f.val}</p>
                  </div>
                </div>
              ))}
            </div>
            {client.preferences && (
              <div className="mt-3 bg-amber-50 rounded-lg p-3 text-sm text-amber-800 border border-amber-200">
                <i className="bi bi-heart mr-1.5" />
                <span className="font-medium">Préférences : </span>{client.preferences}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Interactions & Notes</p>

            {/* Add note form */}
            <form onSubmit={handleAddNote} className="mb-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex gap-2 mb-2">
                <select value={noteType} onChange={e => setNoteType(e.target.value)}
                  className="text-xs px-1 py-1.5 bg-white text-gray-700 flex-1">
                  {NOTE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)}
                placeholder="Écrire une note ou interaction…"
                rows={2}
                className="w-full text-sm p-1 resize-none bg-white" />
              <div className="flex justify-end mt-2">
                <button type="submit" disabled={addingNote || !noteContent.trim()}
                  className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40">
                  <i className="bi bi-plus-lg mr-1" /> Ajouter
                </button>
              </div>
            </form>

            {/* Timeline */}
            {loadingNotes ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                <i className="bi bi-arrow-repeat animate-spin mr-2" />Chargement…
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <i className="bi bi-journal-text text-2xl block mb-2 opacity-40" />
                <p className="text-sm">Aucune interaction enregistrée</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map(note => (
                  <div key={note.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${NOTE_STYLES[note.note_type]}`}>
                        <i className={`bi ${NOTE_ICONS[note.note_type]} text-[11px]`} />
                      </div>
                      <div className="w-px flex-1 bg-gray-100 mt-1" />
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${NOTE_STYLES[note.note_type].split(' ')[1]}`}>
                            {note.note_type_display}
                          </span>
                          <button onClick={() => handleDeleteNote(note.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors text-sm">
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{note.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                          <i className="bi bi-person" /> {note.author_name}
                          <span>·</span>
                          <i className="bi bi-clock" /> {new Date(note.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main CRM Page ──────────────────────────────────────────────────────────────

const PERIODS = [
  { value: '',      label: 'Tous les séjours' },
  { value: '30d',   label: '30 derniers jours' },
  { value: '90d',   label: '3 derniers mois' },
  { value: '180d',  label: '6 derniers mois' },
  { value: '365d',  label: 'Cette année' },
  { value: 'never', label: 'Jamais séjourné' },
  { value: 'custom',label: 'Période personnalisée' },
]

function periodToParams(period: string, dateFrom: string, dateTo: string): Record<string, string> {
  if (period === 'never') return { no_stays: 'true' }
  if (period === 'custom') {
    const p: Record<string, string> = {}
    if (dateFrom) p.last_stay_after  = dateFrom
    if (dateTo)   p.last_stay_before = dateTo
    return p
  }
  if (!period) return {}
  const days = parseInt(period)
  const after = new Date()
  after.setDate(after.getDate() - days)
  return { last_stay_after: after.toISOString().slice(0, 10) }
}

export default function CRMPage() {
  const { user } = useAuth()
  const [clients, setClients]       = useState<Client[]>([])
  const [stats, setStats]           = useState<CRMStats | null>(null)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const debouncedSearch             = useDebounce(search, 300)
  const [vipFilter, setVipFilter]   = useState('')
  const [period, setPeriod]         = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [selected, setSelected]     = useState<Client | null>(null)
  const [page, setPage]             = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [displaySettings, setDisplaySettings] = useState<CrmDisplaySettings>(() => loadCrmSettings(user?.username ?? 'guest'))
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const PAGE_SIZE = displaySettings.pageSize

  const saveDisplaySettings = (next: CrmDisplaySettings) => {
    setDisplaySettings(next)
    localStorage.setItem(crmSettingsKey(user?.username ?? 'guest'), JSON.stringify(next))
    setPage(1)
  }

  useEffect(() => {
    if (!showSettings) return
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [showSettings])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), page_size: String(displaySettings.pageSize) }
      if (debouncedSearch) params.search     = debouncedSearch
      if (vipFilter)       params.vip_status = vipFilter
      Object.assign(params, periodToParams(period, dateFrom, dateTo))
      const statsParams = {
        top_limit: String(displaySettings.topClientsLimit),
        birthdays_limit: String(displaySettings.birthdaysLimit),
        birthdays_days: String(displaySettings.birthdaysDays),
      }
      const [res, st] = await Promise.all([clientsApi.list(params), clientsApi.stats(statsParams)])
      setClients(res.results)
      setTotalCount(res.count)
      setStats(st)
    } catch (err) { toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [debouncedSearch, vipFilter, period, dateFrom, dateTo, page, displaySettings])

  useEffect(() => { loadAll() }, [loadAll])

  const updateClient = (updated: Client) => {
    setClients(cs => cs.map(c => c.id === updated.id ? updated : c))
    if (selected?.id === updated.id) setSelected(updated)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700 font-medium">{totalCount} client{totalCount > 1 ? 's' : ''} au total</p>
          <div ref={settingsRef} className="relative">
            <button
              onClick={() => setShowSettings(o => !o)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              title="Paramètres d'affichage"
            >
              <i className="bi bi-sliders" /> Paramètres
            </button>
            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-4 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Affichage</p>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Clients dans le Top</label>
                  <select
                    value={displaySettings.topClientsLimit}
                    onChange={e => saveDisplaySettings({ ...displaySettings, topClientsLimit: Number(e.target.value) })}
                    className="w-full text-sm px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Anniversaires affichés</label>
                  <select
                    value={displaySettings.birthdaysLimit}
                    onChange={e => saveDisplaySettings({ ...displaySettings, birthdaysLimit: Number(e.target.value) })}
                    className="w-full text-sm px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fenêtre anniversaires</label>
                  <select
                    value={displaySettings.birthdaysDays}
                    onChange={e => saveDisplaySettings({ ...displaySettings, birthdaysDays: Number(e.target.value) })}
                    className="w-full text-sm px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    {[7, 14, 30, 60, 90].map(n => <option key={n} value={n}>{n} jours</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Résultats par page (tableau)</label>
                  <select
                    value={displaySettings.pageSize}
                    onChange={e => saveDisplaySettings({ ...displaySettings, pageSize: Number(e.target.value) })}
                    className="w-full text-sm px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => saveDisplaySettings(CRM_SETTINGS_DEFAULTS)}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <i className="bi bi-arrow-counterclockwise" /> Réinitialiser
                </button>
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Total clients',    val: stats?.total ?? '—',          icon: 'bi-people',        color: 'text-gray-600' },
          { label: 'VIP',             val: stats?.vip_count ?? '—',       icon: 'bi-star-fill',     color: 'text-amber-500' },
          { label: 'VVIP',            val: stats?.vvip_count ?? '—',      icon: 'bi-gem',           color: 'text-yellow-600' },
          { label: 'Nouveaux/mois',   val: stats?.new_this_month ?? '—',  icon: 'bi-person-plus',   color: 'text-blue-500' },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3">
            <i className={`bi ${s.icon} text-2xl ${s.color}`} />
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.val}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Client table */}
        <div className="xl:col-span-2">
          {/* Filters */}
          <div className="space-y-2 mb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Nom, email, téléphone…"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-white placeholder:text-gray-400" />
              </div>
              {/* VIP filter */}
              <select value={vipFilter} onChange={e => { setVipFilter(e.target.value); setPage(1) }}
                className="w-full sm:w-40 text-sm px-1 py-2 bg-white">
                <option value="">Tous les statuts</option>
                <option value="regular">Régulier</option>
                <option value="vip">VIP</option>
                <option value="vvip">VVIP</option>
              </select>
              {/* Period filter */}
              <select value={period} onChange={e => { setPeriod(e.target.value); setDateFrom(''); setDateTo(''); setPage(1) }}
                className="w-full sm:w-52 text-sm px-1 py-2 bg-white">
                {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {/* Custom date range — visible only when period === 'custom' */}
            {period === 'custom' && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <i className="bi bi-calendar-range text-amber-500 text-sm shrink-0" />
                <span className="text-xs text-amber-700 font-medium shrink-0">Dernier séjour entre :</span>
                <div className="flex items-center gap-2 flex-1">
                  <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                    className="flex-1 text-sm border-b border-amber-300 px-1 py-1.5 bg-white focus:border-amber-500" />
                  <span className="text-xs text-amber-500 shrink-0">et</span>
                  <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
                    className="flex-1 text-sm border-b border-amber-300 px-1 py-1.5 bg-white focus:border-amber-500" />
                  {(dateFrom || dateTo) && (
                    <button onClick={() => { setDateFrom(''); setDateTo('') }}
                      className="text-amber-400 hover:text-amber-600 transition-colors text-sm shrink-0">
                      <i className="bi bi-x-circle" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Active filter badge */}
            {(period && period !== 'custom') && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full font-medium">
                  <i className="bi bi-calendar-check text-[10px]" />
                  {PERIODS.find(p => p.value === period)?.label}
                  <button onClick={() => { setPeriod(''); setPage(1) }} className="ml-0.5 hover:text-amber-600">
                    <i className="bi bi-x text-[11px]" />
                  </button>
                </span>
              </div>
            )}
          </div>

          <div className="card p-0 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Client', 'Contact', 'Statut', 'Séjours', 'Valeur', 'Dernier séjour'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonTableRow key={i} cols={6} />)
                ) : clients.map(c => (
                  <tr key={c.id}
                    onClick={() => setSelected(c)}
                    className={`cursor-pointer hover:bg-amber-50/60 transition-colors ${selected?.id === c.id ? 'bg-amber-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          c.vip_status === 'vvip' ? 'bg-yellow-100 text-yellow-800' :
                          c.vip_status === 'vip'  ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {c.first_name?.[0]}{c.last_name?.[0]}
                        </div>
                        <span className="font-medium text-gray-900">{c.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      <div>{c.phone}</div>
                      {c.email && <div className="text-gray-400">{c.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge border flex items-center gap-1 w-fit text-xs font-semibold ${VIP_STYLES[c.vip_status]}`}>
                        <i className={`bi ${VIP_ICONS[c.vip_status]} text-[10px]`} />
                        {c.vip_status_display}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{c.bookings_count}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium text-xs">{formatFcfa(c.lifetime_value)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(c.last_stay_date)}</td>
                  </tr>
                ))}
                {!loading && clients.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-400">
                    <i className="bi bi-people text-3xl block mb-2 opacity-40" />
                    Aucun client trouvé
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
              <span>{totalCount} résultat{totalCount > 1 ? 's' : ''}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="btn-secondary text-xs px-2 py-1 disabled:opacity-40">
                  <i className="bi bi-chevron-left" />
                </button>
                <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs">
                  {page} / {totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="btn-secondary text-xs px-2 py-1 disabled:opacity-40">
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Top clients + Birthdays */}
        <div className="space-y-4">
          {/* Top clients */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <i className="bi bi-trophy text-amber-500" /> Top clients
            </h3>
            {stats?.top_clients.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p>
            ) : (
              <div className="space-y-2">
                {stats?.top_clients.map((tc, i) => (
                  <div key={tc.id} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' :
                      i === 1 ? 'bg-gray-100 text-gray-500' :
                      i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{tc.full_name}</p>
                      <p className="text-xs text-gray-400">{tc.bookings_count} séjour{tc.bookings_count > 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-xs font-semibold text-gray-700 shrink-0">{formatFcfa(tc.lifetime_value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming birthdays */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <i className="bi bi-cake2 text-pink-500" /> Anniversaires (30j)
            </h3>
            {!stats?.upcoming_birthdays.length ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucun anniversaire à venir</p>
            ) : (
              <div className="space-y-2">
                {stats.upcoming_birthdays.map(b => (
                  <div key={b.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
                      <i className="bi bi-cake2 text-pink-500 text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{b.full_name}</p>
                      <p className="text-xs text-gray-400">{formatDate(b.birthday)}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      b.days_until === 0 ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {b.days_until === 0 ? "Aujourd'hui" : `J-${b.days_until}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Client detail panel */}
      {selected && (
        <ClientPanel
          client={selected}
          onClose={() => setSelected(null)}
          onUpdate={updateClient}
        />
      )}
    </div>
  )
}
