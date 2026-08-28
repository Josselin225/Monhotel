import { useState, useEffect, useCallback, Fragment } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  amenityApi, menuItemApi, AMENITY_META, STATUS_OPTIONS, STATUS_COLORS, MENU_CATEGORIES,
  AmenityReservation, AmenityStats, AmenityType, MenuItem,
} from '../api/amenities'
import { clientsApi } from '../api/clients'
import { Client } from '../types'
import { formatDate, formatFcfa, getApiError } from '../utils'
import PageHeader from '../components/PageHeader'
import FormField from '../components/FormField'
import { SkeletonTablePage } from '../components/Skeleton'
import { useDebounce } from '../hooks/useDebounce'

const EMPTY_FORM = {
  client: '', client_name: '', client_phone: '', date: '', start_time: '12:00', end_time: '',
  party_size: 1, detail: '', price: '', status: 'pending', notes: '',
}

const EMPTY_STATS: AmenityStats = { total: 0, today: 0, pending: 0, confirmed: 0 }
const EMPTY_MENU_ITEM = { name: '', description: '', category: 'main', price: '', is_available: true }

interface ClientGroup {
  key: string
  client_name: string
  client_phone: string
  online: boolean
  reservations: AmenityReservation[]
}

/** Regroupe les réservations par client (fiche existante, sinon nom+téléphone
 * pour un client de passage) — évite une ligne par occasion (ex: 3 repas/jour). */
function groupByClient(reservations: AmenityReservation[]): ClientGroup[] {
  const map = new Map<string, ClientGroup>()
  for (const r of reservations) {
    const key = r.client ? `c${r.client}` : `p${r.client_name}|${r.client_phone}`
    let group = map.get(key)
    if (!group) {
      group = { key, client_name: r.client_full_name || r.client_name, client_phone: r.client_phone, online: false, reservations: [] }
      map.set(key, group)
    }
    if (r.source === 'online') group.online = true
    group.reservations.push(r)
  }
  return Array.from(map.values())
}

export default function AmenitiesPage() {
  const { amenity } = useParams<{ amenity: string }>()
  const meta = amenity && amenity in AMENITY_META ? AMENITY_META[amenity as AmenityType] : null

  const [tab, setTab] = useState<'reservations' | 'menu'>('reservations')

  const [reservations, setReservations] = useState<AmenityReservation[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [stats, setStats] = useState<AmenityStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: '', date: '', search: '' })
  const debouncedSearch = useDebounce(filter.search, 300)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AmenityReservation | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // ── Menu du jour (restaurant uniquement) ────────────────────────────
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null)
  const [menuForm, setMenuForm] = useState(EMPTY_MENU_ITEM)
  const [savingMenuItem, setSavingMenuItem] = useState(false)

  const load = useCallback(async () => {
    if (!meta || !amenity) return
    setLoading(true)
    try {
      const params: Record<string, string> = { amenity }
      if (filter.status) params.status = filter.status
      if (filter.date) { params.date_from = filter.date; params.date_to = filter.date }
      if (debouncedSearch) params.search = debouncedSearch
      const [res, s] = await Promise.all([
        amenityApi.list(params),
        amenityApi.stats({ amenity }),
      ])
      setReservations(res)
      setStats(s)
      setSelected(new Set())
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [amenity, meta, filter.status, filter.date, debouncedSearch])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    clientsApi.list({ page_size: '500' }).then(r => setClients(r.results)).catch(() => {})
  }, [])

  const loadMenu = useCallback(async () => {
    setMenuLoading(true)
    try {
      setMenuItems(await menuItemApi.list())
    } catch (err) { toast.error(getApiError(err)) }
    finally { setMenuLoading(false) }
  }, [])

  useEffect(() => {
    if (amenity === 'restaurant' && tab === 'menu') loadMenu()
  }, [amenity, tab, loadMenu])

  if (!meta) {
    return (
      <div className="p-4">
        <PageHeader><p className="text-sm text-gray-700">Service inconnu.</p></PageHeader>
      </div>
    )
  }

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (r: AmenityReservation) => {
    setEditing(r)
    setForm({
      client: r.client ? String(r.client) : '', client_name: r.client_name, client_phone: r.client_phone,
      date: r.date, start_time: r.start_time.slice(0, 5), end_time: r.end_time ? r.end_time.slice(0, 5) : '',
      party_size: r.party_size, detail: r.detail, price: r.price ?? '', status: r.status, notes: r.notes,
    })
    setShowModal(true)
  }

  const onSelectClient = (id: string) => {
    const c = clients.find(cl => String(cl.id) === id)
    setForm(f => ({ ...f, client: id, client_name: c ? c.full_name : f.client_name, client_phone: c ? c.phone : f.client_phone }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_name.trim()) { toast.error('Le nom du client est requis'); return }
    setSaving(true)
    try {
      const payload = {
        amenity: amenity as AmenityType,
        client: form.client ? Number(form.client) : null,
        client_name: form.client_name, client_phone: form.client_phone,
        date: form.date, start_time: form.start_time, end_time: form.end_time || null,
        party_size: Number(form.party_size) || 1, detail: form.detail,
        price: form.price === '' ? null : String(form.price),
        status: form.status, notes: form.notes,
      }
      if (editing) {
        await amenityApi.update(editing.id, payload)
        toast.success('Réservation mise à jour')
      } else {
        await amenityApi.create(payload)
        toast.success('Réservation créée')
      }
      setShowModal(false)
      load()
    } catch (err) { toast.error(getApiError(err)) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette réservation ?')) return
    try {
      await amenityApi.remove(id)
      toast.success('Réservation supprimée')
      setSelected(s => { const n = new Set(s); n.delete(id); return n })
      load()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const toggleExpand = (key: string) => {
    setExpanded(s => {
      const n = new Set(s)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  const toggleSelect = (id: number) => {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const toggleSelectGroup = (group: ClientGroup) => {
    const deletableIds = group.reservations.filter(r => r.can_delete).map(r => r.id)
    const allSelected = deletableIds.length > 0 && deletableIds.every(id => selected.has(id))
    setSelected(s => {
      const n = new Set(s)
      deletableIds.forEach(id => allSelected ? n.delete(id) : n.add(id))
      return n
    })
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`Supprimer ${selected.size} réservation${selected.size > 1 ? 's' : ''} ?`)) return
    setBulkDeleting(true)
    try {
      const res = await amenityApi.bulkDelete(Array.from(selected))
      if (res.skipped.length > 0) {
        toast.warning(`${res.count} supprimée(s) — ${res.skipped.length} ignorée(s) (confirmée${res.skipped.length > 1 ? 's' : ''} et à venir, à annuler d'abord)`)
      } else {
        toast.success(`${res.count} réservation${res.count > 1 ? 's' : ''} supprimée${res.count > 1 ? 's' : ''}`)
      }
      setSelected(new Set())
      load()
    } catch (err) { toast.error(getApiError(err)) }
    finally { setBulkDeleting(false) }
  }

  const openCreateMenuItem = () => { setEditingMenuItem(null); setMenuForm(EMPTY_MENU_ITEM); setShowMenuModal(true) }
  const openEditMenuItem = (item: MenuItem) => {
    setEditingMenuItem(item)
    setMenuForm({ name: item.name, description: item.description, category: item.category, price: item.price, is_available: item.is_available })
    setShowMenuModal(true)
  }

  const handleMenuItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!menuForm.name.trim()) { toast.error('Le nom du plat est requis'); return }
    setSavingMenuItem(true)
    try {
      const payload = { ...menuForm, price: menuForm.price === '' ? '0' : String(menuForm.price) }
      if (editingMenuItem) {
        await menuItemApi.update(editingMenuItem.id, payload)
        toast.success('Plat mis à jour')
      } else {
        await menuItemApi.create(payload)
        toast.success('Plat ajouté au menu')
      }
      setShowMenuModal(false)
      loadMenu()
    } catch (err) { toast.error(getApiError(err)) }
    finally { setSavingMenuItem(false) }
  }

  const handleMenuItemDelete = async (id: number) => {
    if (!confirm('Retirer ce plat du menu ?')) return
    try { await menuItemApi.delete(id); toast.success('Plat supprimé'); loadMenu() }
    catch (err) { toast.error(getApiError(err)) }
  }

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {tab === 'reservations' ? (
            <>
              <p className="text-sm text-gray-700 font-medium flex items-center gap-2">
                <i className={`bi ${meta.icon} text-hotel-gold`} /> {reservations.length} réservation{reservations.length > 1 ? 's' : ''} — {meta.label}
              </p>
              <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto">
                <i className="bi bi-plus-lg" /> Nouvelle réservation
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-700 font-medium flex items-center gap-2">
                <i className="bi bi-journal-richtext text-hotel-gold" /> {menuItems.length} plat{menuItems.length > 1 ? 's' : ''} au menu
              </p>
              <button onClick={openCreateMenuItem} className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto">
                <i className="bi bi-plus-lg" /> Nouveau plat
              </button>
            </>
          )}
        </div>
      </PageHeader>

      {amenity === 'restaurant' && (
        <div className="flex gap-1 mb-5 border-b border-gray-200">
          {([
            { key: 'reservations', label: 'Réservations', icon: 'bi-journal-bookmark' },
            { key: 'menu',         label: 'Menu du jour',  icon: 'bi-journal-richtext' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? 'border-hotel-gold text-hotel-gold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              <i className={`bi ${t.icon}`} />{t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'reservations' && (<>
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total',      value: stats.total,     icon: 'bi-journal-bookmark', color: 'text-gray-600 bg-gray-50' },
          { label: "Aujourd'hui", value: stats.today,    icon: 'bi-calendar-day',     color: 'text-blue-600 bg-blue-50' },
          { label: 'En attente', value: stats.pending,   icon: 'bi-hourglass-split',  color: 'text-amber-600 bg-amber-50' },
          { label: 'Confirmées', value: stats.confirmed, icon: 'bi-check-circle-fill', color: 'text-green-600 bg-green-50' },
        ].map(kpi => (
          <div key={kpi.label} className="card flex items-center gap-3 py-3 px-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.color}`}>
              <i className={`bi ${kpi.icon}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-xs text-gray-400">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-4 flex flex-col sm:flex-row gap-3 py-3 items-stretch sm:items-center">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <i className="bi bi-search text-gray-400" />
          <input type="text" placeholder="Client, téléphone, détail…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
            value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} />
          {filter.search && <button onClick={() => setFilter({ ...filter, search: '' })} className="text-gray-400 hover:text-gray-600"><i className="bi bi-x" /></button>}
        </div>
        <input type="date" className="input-box w-full sm:w-44" value={filter.date}
          onChange={e => setFilter({ ...filter, date: e.target.value })} />
        <select className="input-box w-full sm:w-40" value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="">Tous les statuts</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Barre d'actions groupées */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-hotel-gold/10 border border-hotel-gold/30 rounded-xl px-4 py-2.5">
          <p className="text-sm font-medium text-gray-700">
            {selected.size} réservation{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="btn-secondary text-xs px-3 py-1.5">Annuler</button>
            <button onClick={handleBulkDelete} disabled={bulkDeleting} className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5">
              {bulkDeleting ? <i className="bi bi-arrow-repeat animate-spin" /> : <i className="bi bi-trash" />} Supprimer
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonTablePage cardCount={0} rows={8} cols={6} withToolbar={false} />
      ) : (
        <div className="card p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[850px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="w-10 px-4 py-3" />
                {['Client', 'Date', 'Heure', 'Personnes', meta.detailLabel, 'Statut', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {groupByClient(reservations).map(group => {
                const isOpen = expanded.has(group.key)
                const deletableIds = group.reservations.filter(r => r.can_delete).map(r => r.id)
                const allGroupSelected = deletableIds.length > 0 && deletableIds.every(id => selected.has(id))
                const statusCounts = STATUS_OPTIONS
                  .map(s => ({ ...s, count: group.reservations.filter(r => r.status === s.value).length }))
                  .filter(s => s.count > 0)
                const nextDate = group.reservations.map(r => r.date).sort()[0]
                const totalPrice = group.reservations.reduce((sum, r) => sum + (r.price ? Number(r.price) : 0), 0)

                return (
                  <Fragment key={group.key}>
                    <tr
                      onClick={() => toggleExpand(group.key)}
                      className="hover:bg-gray-50/60 transition-colors cursor-pointer">
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {deletableIds.length > 0 && (
                          <input type="checkbox" checked={allGroupSelected} onChange={() => toggleSelectGroup(group)}
                            className="w-4 h-4 rounded border-gray-300 text-hotel-gold" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 flex items-center gap-1.5">
                          <i className={`bi bi-chevron-${isOpen ? 'down' : 'right'} text-gray-400 text-xs`} />
                          {group.client_name}
                          {group.online && <i className="bi bi-globe text-blue-400 text-xs" title="Réservation(s) en ligne" />}
                        </p>
                        {group.client_phone && <p className="text-xs text-gray-500 ml-4">{group.client_phone}</p>}
                        {totalPrice > 0 && <p className="text-xs text-gray-400 ml-4">{formatFcfa(totalPrice)}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {group.reservations.length > 1
                          ? <>{formatDate(nextDate)} <span className="text-gray-400">+{group.reservations.length - 1}</span></>
                          : formatDate(nextDate)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">—</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">—</td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {group.reservations.length} réservation{group.reservations.length > 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {statusCounts.map(s => (
                            <span key={s.value} className={`badge border ${STATUS_COLORS[s.value]}`}>{s.count} {s.label.toLowerCase()}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`} />
                      </td>
                    </tr>
                    {isOpen && group.reservations.map(r => (
                      <tr key={r.id} className="bg-gray-50/40 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 pl-8">
                          {r.can_delete && (
                            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)}
                              className="w-4 h-4 rounded border-gray-300 text-hotel-gold" />
                          )}
                        </td>
                        <td className="px-4 py-2.5 pl-8 text-gray-500 text-xs">
                          {r.source === 'online' && <i className="bi bi-globe text-blue-400 mr-1" title="Réservée en ligne par le client" />}
                          {r.price && formatFcfa(Number(r.price))}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{formatDate(r.date)}</td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">
                          {r.start_time.slice(0, 5)}{r.end_time ? `–${r.end_time.slice(0, 5)}` : ''}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-sm">{r.party_size}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-sm">{r.detail || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`badge border ${STATUS_COLORS[r.status]}`}>{r.status_display}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(r)} className="btn-secondary text-xs px-2 py-1"><i className="bi bi-pencil" /></button>
                            <button onClick={() => handleDelete(r.id)} disabled={!r.can_delete} title={!r.can_delete ? "Confirmée et à venir : annulez-la d'abord" : ''}
                              className="btn-danger text-xs px-2 py-1 disabled:opacity-30 disabled:cursor-not-allowed">
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
              {reservations.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-400">
                  <i className={`bi ${meta.icon} text-3xl block mb-2 opacity-30`} />
                  Aucune réservation
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      </>)}

      {tab === 'menu' && (
        <div>
          {menuLoading ? (
            <SkeletonTablePage cardCount={0} rows={6} cols={5} withToolbar={false} />
          ) : (
            <div className="card p-0 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Plat', 'Catégorie', 'Prix', 'Au menu', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {menuItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {item.description && <p className="text-xs text-gray-500 truncate max-w-[280px]">{item.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge border text-blue-700 bg-blue-50 border-blue-200">{item.category_display}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{formatFcfa(Number(item.price))}</td>
                      <td className="px-4 py-3">
                        <span className={`badge border ${item.is_available ? 'text-green-700 bg-green-50 border-green-200' : 'text-gray-500 bg-gray-100 border-gray-200'}`}>
                          {item.is_available ? 'Oui' : 'Non'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEditMenuItem(item)} className="btn-secondary text-xs px-2 py-1"><i className="bi bi-pencil" /></button>
                          <button onClick={() => handleMenuItemDelete(item.id)} className="btn-danger text-xs px-2 py-1"><i className="bi bi-trash" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {menuItems.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-16 text-center text-gray-400">
                      <i className="bi bi-journal-richtext text-3xl block mb-2 opacity-30" />
                      Aucun plat au menu
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Create / Edit modal ───────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <i className={`bi ${meta.icon} text-amber-600 text-lg`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{editing ? 'Modifier la réservation' : 'Nouvelle réservation'}</h3>
                  <p className="text-xs text-gray-400">{meta.label}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <FormField label="Client existant" icon="bi-person-check">
                <select value={form.client} onChange={e => onSelectClient(e.target.value)} className="appearance-none">
                  <option value="">Aucun — client de passage</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name} — {c.phone}</option>)}
                </select>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Nom du client" icon="bi-person" required>
                  <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Ex: Jean Koné" />
                </FormField>
                <FormField label="Téléphone" icon="bi-telephone">
                  <input type="tel" value={form.client_phone}
                    onChange={e => setForm({ ...form, client_phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="07XXXXXXXX" maxLength={10} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Date" icon="bi-calendar3" required>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                </FormField>
                <FormField label="Nombre de personnes" icon="bi-people" required>
                  <input type="number" min="1" value={form.party_size} onChange={e => setForm({ ...form, party_size: Number(e.target.value) })} required />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Heure début" icon="bi-clock" required>
                  <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
                </FormField>
                <FormField label="Heure fin" icon="bi-clock-history">
                  <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label={meta.detailLabel} icon="bi-tag">
                  <input value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })} placeholder={meta.detailPlaceholder} />
                </FormField>
                <FormField label="Prix (FCFA)" icon="bi-cash-coin">
                  <input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="optionnel" />
                </FormField>
              </div>

              {editing && (
                <FormField label="Statut" icon="bi-bookmark">
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="appearance-none">
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </FormField>
              )}

              <FormField label="Notes" icon="bi-card-text">
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Informations supplémentaires…" rows={2}
                  className="block w-full bg-transparent border-0 border-b-2 border-gray-200 pl-9 pr-0 py-2.5 text-sm focus:outline-none focus:ring-0 focus:border-amber-500 placeholder:text-gray-400 resize-none" />
              </FormField>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary min-w-[120px] justify-center">
                  {saving ? <i className="bi bi-arrow-repeat animate-spin" /> : <><i className={`bi ${editing ? 'bi-check-lg' : 'bi-plus-lg'}`} />{editing ? 'Enregistrer' : 'Créer'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Menu item create / edit modal ───────────────────────── */}
      {showMenuModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowMenuModal(false)}>
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <i className="bi bi-journal-richtext text-amber-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{editingMenuItem ? 'Modifier le plat' : 'Nouveau plat'}</h3>
                  <p className="text-xs text-gray-400">Menu du restaurant</p>
                </div>
              </div>
              <button onClick={() => setShowMenuModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>
            <form onSubmit={handleMenuItemSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Nom du plat" icon="bi-egg-fried" required>
                  <input value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="Ex: Poulet braisé" />
                </FormField>
                <FormField label="Catégorie" icon="bi-tag">
                  <select value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })} className="appearance-none">
                    {MENU_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </FormField>
              </div>

              <FormField label="Description" icon="bi-card-text">
                <textarea value={menuForm.description} onChange={e => setMenuForm({ ...menuForm, description: e.target.value })}
                  placeholder="Ingrédients, accompagnement…" rows={2}
                  className="block w-full bg-transparent border-0 border-b-2 border-gray-200 pl-9 pr-0 py-2.5 text-sm focus:outline-none focus:ring-0 focus:border-amber-500 placeholder:text-gray-400 resize-none" />
              </FormField>

              <FormField label="Prix (FCFA)" icon="bi-cash-coin" required>
                <input type="number" min="0" value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} required />
              </FormField>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={menuForm.is_available} onChange={e => setMenuForm({ ...menuForm, is_available: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-hotel-gold" />
                <span className="text-sm text-gray-700">Au menu du jour (visible des clients)</span>
              </label>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowMenuModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={savingMenuItem} className="btn-primary min-w-[120px] justify-center">
                  {savingMenuItem ? <i className="bi bi-arrow-repeat animate-spin" /> : <><i className={`bi ${editingMenuItem ? 'bi-check-lg' : 'bi-plus-lg'}`} />{editingMenuItem ? 'Enregistrer' : 'Ajouter'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
