import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { maintenanceApi, technicianApi, MaintenanceTicket, Technician, PRIORITY_COLORS, STATUS_COLORS, CATEGORIES, SPECIALTIES } from '../api/maintenance'
import { roomsApi } from '../api/rooms'
import { Room } from '../types'
import { formatDate, formatFcfa, getApiError } from '../utils'
import Pagination from '../components/Pagination'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'
import { useDebounce } from '../hooks/useDebounce'
import { SkeletonTablePage } from '../components/Skeleton'

const EMPTY_FORM = {
  room: '', location: '', category: 'other', priority: 'medium',
  status: 'open', title: '', description: '', assigned_to: '', technician: '',
}

const EMPTY_TECH = { name: '', phone: '', email: '', specialty: '', company: '', notes: '', is_active: true }

const EMPTY_RESOLVE = { resolution_notes: '', cost: '' }

export default function MaintenancePage() {
  const [tab, setTab]             = useState<'tickets' | 'technicians'>('tickets')

  const [tickets, setTickets]     = useState<MaintenanceTicket[]>([])
  const [rooms, setRooms]         = useState<Room[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState({ status: '', priority: '', search: '' })
  const debouncedSearch           = useDebounce(filter.search, 300)
  const [stats, setStats]         = useState({ total: 0, open: 0, in_progress: 0, resolved: 0, urgent: 0 })

  // ── Technician state ───────────────────────────────────────────────
  const [techLoading, setTechLoading]     = useState(false)
  const [showTechModal, setShowTechModal] = useState(false)
  const [editingTech, setEditingTech]     = useState<Technician | null>(null)
  const [techForm, setTechForm]           = useState(EMPTY_TECH)
  const [savingTech, setSavingTech]       = useState(false)

  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<MaintenanceTicket | null>(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)

  const [showResolve, setShowResolve] = useState<MaintenanceTicket | null>(null)
  const [resolveForm, setResolveForm] = useState(EMPTY_RESOLVE)
  const [resolving, setResolving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page) }
      if (filter.status)   params.status   = filter.status
      if (filter.priority) params.priority = filter.priority
      if (debouncedSearch) params.search   = debouncedSearch
      const [t, s, r, tech] = await Promise.all([
        maintenanceApi.list(params),
        maintenanceApi.stats(),
        roomsApi.list({ page_size: '200' }),
        technicianApi.list({ active: 'true' }),
      ])
      setTickets(t.results)
      setTotal(t.count)
      setStats(s)
      setRooms(r.results)
      setTechnicians(tech)
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [filter.status, filter.priority, debouncedSearch, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [filter.status, filter.priority, debouncedSearch])

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (t: MaintenanceTicket) => {
    setEditing(t)
    setForm({
      room: t.room ? String(t.room) : '',
      location: t.location,
      category: t.category,
      priority: t.priority,
      status: t.status,
      title: t.title,
      description: t.description,
      assigned_to: t.assigned_to ? String(t.assigned_to) : '',
      technician: t.technician ? String(t.technician) : '',
    })
    setShowModal(true)
  }

  const loadTechnicians = async () => {
    setTechLoading(true)
    try {
      const all = await technicianApi.list()
      setTechnicians(all)
    } catch (err) { toast.error(getApiError(err)) }
    finally { setTechLoading(false) }
  }

  const openCreateTech = () => { setEditingTech(null); setTechForm(EMPTY_TECH); setShowTechModal(true) }
  const openEditTech = (t: Technician) => {
    setEditingTech(t)
    setTechForm({ name: t.name, phone: t.phone, email: t.email, specialty: t.specialty, company: t.company, notes: t.notes, is_active: t.is_active })
    setShowTechModal(true)
  }

  const handleTechSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!techForm.name.trim())     { toast.error('Le nom est requis'); return }
    if (!techForm.specialty)       { toast.error('La spécialité est requise'); return }
    if (!techForm.phone.trim() && !techForm.email.trim()) { toast.error('Au moins un contact (téléphone ou email) est requis'); return }
    setSavingTech(true)
    try {
      if (editingTech) {
        await technicianApi.update(editingTech.id, techForm)
        toast.success('Technicien mis à jour')
      } else {
        await technicianApi.create(techForm)
        toast.success('Technicien enregistré')
      }
      setShowTechModal(false)
      loadTechnicians()
    } catch (err) { toast.error(getApiError(err)) }
    finally { setSavingTech(false) }
  }

  const handleTechDelete = async (id: number) => {
    if (!confirm('Supprimer ce technicien ?')) return
    try { await technicianApi.delete(id); toast.success('Technicien supprimé'); loadTechnicians() }
    catch (err) { toast.error(getApiError(err)) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Le titre est requis'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        room: form.room ? Number(form.room) : null,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
        technician: form.technician ? Number(form.technician) : null,
      }
      if (editing) {
        await maintenanceApi.update(editing.id, payload)
        toast.success('Ticket mis à jour')
      } else {
        await maintenanceApi.create(payload)
        toast.success('Ticket créé')
      }
      setShowModal(false); load()
    } catch (err) { toast.error(getApiError(err)) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce ticket ?')) return
    try { await maintenanceApi.delete(id); toast.success('Ticket supprimé'); load() }
    catch (err) { toast.error(getApiError(err)) }
  }

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showResolve) return
    setResolving(true)
    try {
      await maintenanceApi.resolve(showResolve.id, resolveForm.resolution_notes, resolveForm.cost ? Number(resolveForm.cost) : undefined)
      toast.success('Ticket résolu ✓')
      setShowResolve(null)
      setResolveForm(EMPTY_RESOLVE)
      load()
    } catch (err) { toast.error(getApiError(err)) }
    finally { setResolving(false) }
  }

  const priorityIcon: Record<string, string> = {
    low: 'bi-arrow-down', medium: 'bi-dash', high: 'bi-arrow-up', urgent: 'bi-exclamation-triangle-fill',
  }

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {tab === 'tickets' ? (
            <>
              <p className="text-sm text-gray-700 font-medium">{total} ticket{total > 1 ? 's' : ''}</p>
              <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto">
                <i className="bi bi-plus-lg" /> Nouveau ticket
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-700 font-medium">{technicians.length} technicien{technicians.length > 1 ? 's' : ''}</p>
              <button onClick={openCreateTech} className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto">
                <i className="bi bi-plus-lg" /> Nouveau technicien
              </button>
            </>
          )}
        </div>
      </PageHeader>

      {/* Onglets */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {([
          { key: 'tickets',     label: 'Tickets',     icon: 'bi-tools' },
          { key: 'technicians', label: 'Techniciens', icon: 'bi-person-gear' },
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

      {tab === 'tickets' && (<>
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Total',     value: stats.total,       icon: 'bi-ticket',              color: 'text-gray-600 bg-gray-50' },
          { label: 'Ouverts',   value: stats.open,        icon: 'bi-folder2-open',        color: 'text-amber-600 bg-amber-50' },
          { label: 'En cours',  value: stats.in_progress, icon: 'bi-tools',               color: 'text-blue-600 bg-blue-50' },
          { label: 'Résolus',   value: stats.resolved,    icon: 'bi-check-circle-fill',   color: 'text-green-600 bg-green-50' },
          { label: 'Urgents',   value: stats.urgent,      icon: 'bi-exclamation-triangle-fill', color: 'text-red-600 bg-red-50' },
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
          <input type="text" placeholder="Référence, titre, chambre…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
            value={filter.search} onChange={e => setFilter({...filter, search: e.target.value})} />
          {filter.search && <button onClick={() => setFilter({...filter, search: ''})} className="text-gray-400 hover:text-gray-600"><i className="bi bi-x" /></button>}
        </div>
        <select className="input-box w-full sm:w-44" value={filter.status} onChange={e => setFilter({...filter, status: e.target.value})}>
          <option value="">Tous les statuts</option>
          <option value="open">Ouvert</option>
          <option value="in_progress">En cours</option>
          <option value="resolved">Résolu</option>
          <option value="closed">Fermé</option>
        </select>
        <select className="input-box w-full sm:w-40" value={filter.priority} onChange={e => setFilter({...filter, priority: e.target.value})}>
          <option value="">Toutes priorités</option>
          <option value="urgent">Urgente</option>
          <option value="high">Haute</option>
          <option value="medium">Normale</option>
          <option value="low">Faible</option>
        </select>
      </div>

      {loading ? (
        <SkeletonTablePage cardCount={0} rows={8} cols={5} withToolbar={false} />
      ) : (
        <div className="card p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Réf.','Emplacement','Catégorie','Titre','Priorité','Statut','Signalé le','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tickets.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.reference}</td>
                  <td className="px-4 py-3">
                    {t.room_number ? (
                      <span className="font-medium text-gray-700">Chambre #{t.room_number}</span>
                    ) : (
                      <span className="text-gray-500">{t.location || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{t.category_display}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-[200px]">{t.title}</p>
                    {t.description && <p className="text-xs text-gray-500 truncate max-w-[200px]">{t.description}</p>}
                    {t.technician_name && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <i className="bi bi-person-gear text-amber-500 text-[10px]" />
                        <span className="text-xs text-amber-700 truncate max-w-[180px]">{t.technician_name}</span>
                        {t.technician_phone && <span className="text-xs text-gray-400">· {t.technician_phone}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge border flex items-center gap-1 w-fit ${PRIORITY_COLORS[t.priority]}`}>
                      <i className={`bi ${priorityIcon[t.priority]}`} />{t.priority_display}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge border ${STATUS_COLORS[t.status]}`}>{t.status_display}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(t.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {['open','in_progress'].includes(t.status) && (
                        <button onClick={() => { setShowResolve(t); setResolveForm(EMPTY_RESOLVE) }}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium">
                          <i className="bi bi-check-lg me-1" />Résoudre
                        </button>
                      )}
                      <button onClick={() => openEdit(t)}      className="btn-secondary text-xs px-2 py-1"><i className="bi bi-pencil" /></button>
                      <button onClick={() => handleDelete(t.id)} className="btn-danger text-xs px-2 py-1"><i className="bi bi-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-400">
                  <i className="bi bi-tools text-3xl block mb-2 opacity-30" />
                  Aucun ticket de maintenance
                </td></tr>
              )}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={page} total={total} onChange={setPage} />
          </div>
        </div>
      )}
      </>)}

      {/* ── Onglet Techniciens ──────────────────────────────────── */}
      {tab === 'technicians' && (
        <div>
          {techLoading ? (
            <SkeletonTablePage cardCount={0} rows={6} cols={5} withToolbar={false} />
          ) : (
            <div className="card p-0 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Nom','Spécialité','Entreprise','Contact','Tickets','Statut','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {technicians.map(tech => (
                    <tr key={tech.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                            <span className="text-amber-700 text-sm font-bold">{tech.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="font-medium text-gray-900">{tech.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge border text-blue-700 bg-blue-50 border-blue-200">{tech.specialty_display}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{tech.company || '—'}</td>
                      <td className="px-4 py-3">
                        {tech.phone && <p className="text-sm text-gray-700"><i className="bi bi-telephone me-1 text-gray-400" />{tech.phone}</p>}
                        {tech.email && <p className="text-xs text-gray-500"><i className="bi bi-envelope me-1 text-gray-400" />{tech.email}</p>}
                        {!tech.phone && !tech.email && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{tech.tickets_count}</td>
                      <td className="px-4 py-3">
                        <span className={`badge border ${tech.is_active ? 'text-green-700 bg-green-50 border-green-200' : 'text-gray-500 bg-gray-100 border-gray-200'}`}>
                          {tech.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEditTech(tech)} className="btn-secondary text-xs px-2 py-1"><i className="bi bi-pencil" /></button>
                          <button onClick={() => handleTechDelete(tech.id)} className="btn-danger text-xs px-2 py-1"><i className="bi bi-trash" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {technicians.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                      <i className="bi bi-person-gear text-3xl block mb-2 opacity-30" />
                      Aucun technicien enregistré
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
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
                  <i className="bi bi-tools text-orange-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{editing ? `Ticket ${editing.reference}` : 'Nouveau ticket'}</h3>
                  <p className="text-xs text-gray-400">{editing ? 'Modifier le ticket' : 'Signaler un problème'}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <FormField label="Titre" icon="bi-pencil-square" required>
                <input type="text" placeholder="Ex: Fuite sous le lavabo" value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})} />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Chambre" icon="bi-door-closed">
                  <select value={form.room} onChange={e => setForm({...form, room: e.target.value})} className="appearance-none">
                    <option value="">Zone commune</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>#{r.number} — {r.room_type_name}</option>)}
                  </select>
                </FormField>
                {!form.room && (
                  <FormField label="Emplacement" icon="bi-geo-alt">
                    <input type="text" placeholder="Ex: Hall d'entrée" value={form.location}
                      onChange={e => setForm({...form, location: e.target.value})} />
                  </FormField>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Catégorie" icon="bi-tag">
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="appearance-none">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </FormField>
                <FormField label="Priorité" icon="bi-flag">
                  <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="appearance-none">
                    <option value="low">Faible</option>
                    <option value="medium">Normale</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </FormField>
              </div>

              <FormField label="Technicien assigné" icon="bi-person-gear">
                <select value={form.technician} onChange={e => setForm({...form, technician: e.target.value})} className="appearance-none">
                  <option value="">Aucun technicien</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>{t.name}{t.specialty_display ? ` — ${t.specialty_display}` : ''}</option>
                  ))}
                </select>
              </FormField>

              {editing && (
                <FormField label="Statut" icon="bi-bookmark">
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="appearance-none">
                    <option value="open">Ouvert</option>
                    <option value="in_progress">En cours</option>
                    <option value="resolved">Résolu</option>
                    <option value="closed">Fermé</option>
                  </select>
                </FormField>
              )}

              <FormField label="Description" icon="bi-card-text">
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Décrivez le problème en détail…" rows={3}
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

      {/* ── Resolve modal ──────────────────────────────────────── */}
      {showResolve && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowResolve(null)}>
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                  <i className="bi bi-check-circle text-green-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Résoudre le ticket</h3>
                  <p className="text-xs text-gray-400 truncate max-w-[240px]">{showResolve.title}</p>
                </div>
              </div>
              <button onClick={() => setShowResolve(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>
            <form onSubmit={handleResolve} className="p-6 space-y-4">
              <FormField label="Notes de résolution" icon="bi-card-text">
                <textarea value={resolveForm.resolution_notes} onChange={e => setResolveForm({...resolveForm, resolution_notes: e.target.value})}
                  placeholder="Décrivez ce qui a été fait…" rows={3}
                  className="block w-full bg-transparent border-0 border-b-2 border-gray-200 pl-9 pr-0 py-2.5 text-sm focus:outline-none focus:ring-0 focus:border-amber-500 placeholder:text-gray-400 resize-none" />
              </FormField>
              <FormField label="Coût de l'intervention (FCFA)" icon="bi-cash-coin">
                <input type="number" min="0" placeholder="0 (optionnel)"
                  value={resolveForm.cost} onChange={e => setResolveForm({...resolveForm, cost: e.target.value})} />
              </FormField>
              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowResolve(null)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={resolving} className="btn-primary min-w-[120px] justify-center">
                  {resolving ? <i className="bi bi-arrow-repeat animate-spin" /> : <><i className="bi bi-check-lg me-1" />Marquer résolu</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Technician modal ───────────────────────────────────── */}
      {showTechModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTechModal(false)}>
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <i className="bi bi-person-gear text-amber-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{editingTech ? 'Modifier le technicien' : 'Nouveau technicien'}</h3>
                  <p className="text-xs text-gray-400">Prestataire externe de maintenance</p>
                </div>
              </div>
              <button onClick={() => setShowTechModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>
            <form onSubmit={handleTechSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Nom complet" icon="bi-person" required>
                  <input type="text" placeholder="Ex: Jean Koné" value={techForm.name}
                    onChange={e => setTechForm({...techForm, name: e.target.value})} />
                </FormField>
                <FormField label="Entreprise" icon="bi-building">
                  <input type="text" placeholder="Ex: Plomberie Koné" value={techForm.company}
                    onChange={e => setTechForm({...techForm, company: e.target.value})} />
                </FormField>
              </div>

              <FormField label="Spécialité" icon="bi-tools" required>
                <select value={techForm.specialty} onChange={e => setTechForm({...techForm, specialty: e.target.value})} className="appearance-none" required>
                  <option value="">— Choisir une spécialité —</option>
                  {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Téléphone" icon="bi-telephone" required>
                  <input type="tel" placeholder="07XXXXXXXX" value={techForm.phone}
                    maxLength={10} minLength={10} pattern="[0-9]{10}" required
                    onChange={e => setTechForm({...techForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} />
                </FormField>
                <FormField label="Email" icon="bi-envelope">
                  <input type="email" placeholder="technicien@email.com" value={techForm.email}
                    onChange={e => setTechForm({...techForm, email: e.target.value})} />
                </FormField>
              </div>

              <FormField label="Notes" icon="bi-card-text">
                <textarea value={techForm.notes} onChange={e => setTechForm({...techForm, notes: e.target.value})}
                  placeholder="Informations supplémentaires, tarifs, disponibilités…" rows={2}
                  className="block w-full bg-transparent border-0 border-b-2 border-gray-200 pl-9 pr-0 py-2.5 text-sm focus:outline-none focus:ring-0 focus:border-amber-500 placeholder:text-gray-400 resize-none" />
              </FormField>

              {editingTech && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={techForm.is_active} onChange={e => setTechForm({...techForm, is_active: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-300 text-hotel-gold" />
                  <span className="text-sm text-gray-700">Technicien actif</span>
                </label>
              )}

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowTechModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={savingTech} className="btn-primary min-w-[120px] justify-center">
                  {savingTech ? <i className="bi bi-arrow-repeat animate-spin" /> : <><i className={`bi ${editingTech ? 'bi-check-lg' : 'bi-plus-lg'}`} />{editingTech ? 'Enregistrer' : 'Ajouter'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
