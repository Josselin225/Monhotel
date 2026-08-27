import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { clientsApi } from '../api/clients'
import { bookingsApi } from '../api/bookings'
import { Client, Booking } from '../types'
import { getApiError, formatDate, formatFcfa, BOOKING_STATUS_COLORS } from '../utils'
import Pagination from '../components/Pagination'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'
import { SkeletonTablePage } from '../components/Skeleton'
import { useDebounce } from '../hooks/useDebounce'

const clientSchema = z.object({
  first_name:  z.string().min(1, 'Prénom requis'),
  last_name:   z.string().min(1, 'Nom requis'),
  phone:       z.string().min(6, 'Téléphone requis (min 6 chiffres)'),
  email:       z.string().email('Email invalide').or(z.literal('')),
  nationality: z.string(),
  id_type:     z.string(),
  id_number:   z.string(),
  address:     z.string(),
  notes:       z.string(),
})

type FormErrors = Partial<Record<keyof z.infer<typeof clientSchema>, string>>

const EMPTY_FORM = {
  first_name: '', last_name: '', email: '', phone: '',
  nationality: '', id_type: 'cni', id_number: '', address: '', notes: '',
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const debouncedSearch       = useDebounce(search, 300)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [errors, setErrors]   = useState<FormErrors>({})
  const [saving, setSaving]   = useState(false)
  const [detailClient, setDetailClient] = useState<Client | null>(null)
  const [detailBookings, setDetailBookings] = useState<Booking[]>([])
  const [detailLoading, setDetailLoading]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page) }
      if (debouncedSearch) params.search = debouncedSearch
      const data = await clientsApi.list(params)
      setClients(data.results)
      setTotal(data.count)
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [debouncedSearch, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedSearch])

  const openDetail = async (c: Client) => {
    setDetailClient(c)
    setDetailLoading(true)
    try {
      const data = await bookingsApi.list({ client: String(c.id), page_size: '50' })
      setDetailBookings(data.results)
    } catch { setDetailBookings([]) }
    finally { setDetailLoading(false) }
  }

  const openCreate = () => {
    setEditing(null); setForm(EMPTY_FORM); setErrors({}); setShowModal(true)
  }
  const openEdit = (c: Client) => {
    setEditing(c)
    setForm({ first_name: c.first_name, last_name: c.last_name, email: c.email, phone: c.phone, nationality: c.nationality, id_type: c.id_type, id_number: c.id_number, address: c.address, notes: c.notes })
    setErrors({}); setShowModal(true)
  }

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(err => ({ ...err, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = clientSchema.safeParse(form)
    if (!parsed.success) {
      const errs: FormErrors = {}
      parsed.error.issues.forEach((e: z.ZodIssue) => { if (e.path[0]) errs[e.path[0] as keyof FormErrors] = e.message })
      setErrors(errs); return
    }
    setSaving(true)
    try {
      if (editing) {
        await clientsApi.update(editing.id, parsed.data)
        toast.success('Client mis à jour')
      } else {
        await clientsApi.create(parsed.data)
        toast.success('Client créé')
      }
      setShowModal(false); load()
    } catch (err) { toast.error(getApiError(err))
    } finally { setSaving(false) }
  }

  const handleToggleBlacklist = async (c: Client) => {
    if (c.is_blacklisted) {
      if (!confirm(`Retirer ${c.full_name} de la liste noire ?`)) return
      await clientsApi.toggleBlacklist(c.id)
      toast.success('Client retiré de la liste noire')
    } else {
      const reason = prompt(`Motif de mise en liste noire pour ${c.full_name} :`)
      if (reason === null) return
      await clientsApi.toggleBlacklist(c.id, reason)
      toast.success('Client mis en liste noire')
    }
    load()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce client ?')) return
    try {
      await clientsApi.delete(id); toast.success('Client supprimé'); load()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const handleExportCsv = async () => {
    try {
      const blob = await clientsApi.exportCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'clients.csv'; a.click()
      URL.revokeObjectURL(url)
      toast.success('Export téléchargé')
    } catch { toast.error('Erreur lors de l\'export') }
  }

  const handleExportXlsx = async () => {
    try {
      const blob = await clientsApi.exportXlsx()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'clients.xlsx'; a.click()
      URL.revokeObjectURL(url)
      toast.success('Export Excel téléchargé')
    } catch { toast.error('Erreur lors de l\'export Excel') }
  }

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await clientsApi.importCsv(file)
      toast.success(`Import terminé : ${result.created} créé(s), ${result.skipped} ignoré(s)`)
      if (result.errors?.length) toast.warning(result.errors.slice(0, 3).join('\n'))
      load()
    } catch (err) { toast.error(getApiError(err)) }
    e.target.value = ''
  }

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700 font-medium">{total} client{total > 1 ? 's' : ''} au total</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExportCsv} className="btn-secondary flex items-center gap-2 text-sm">
              <i className="bi bi-download" /> <span className="hidden sm:inline">Export</span> CSV
            </button>
            <button onClick={handleExportXlsx} className="btn-secondary flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-800">
              <i className="bi bi-file-earmark-excel" /> <span className="hidden sm:inline">Export</span> Excel
            </button>
            <label className="btn-secondary flex items-center gap-2 text-sm cursor-pointer">
              <i className="bi bi-upload" /> <span className="hidden sm:inline">Import</span> CSV
              <input type="file" accept=".csv" className="sr-only" onChange={handleImportCsv} />
            </label>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
              <i className="bi bi-plus-lg" /> Nouveau client
            </button>
          </div>
        </div>
      </PageHeader>

      <div className="card mb-4 flex items-center gap-2 py-3">
        <i className="bi bi-search text-gray-400 ml-1" />
        <input type="text" placeholder="Rechercher par nom, téléphone, email…"
          className="flex-1 bg-transparent text-sm focus:outline-none text-gray-700 placeholder:text-gray-400"
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><i className="bi bi-x" /></button>}
        <div className="flex gap-1 ml-2 border-l border-gray-200 pl-2">
          <button
            onClick={() => setViewMode('list')}
            title="Vue liste"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-amber-100 text-amber-700' : 'text-gray-400 hover:bg-gray-100'}`}
          ><i className="bi bi-list-ul text-sm" /></button>
          <button
            onClick={() => setViewMode('grid')}
            title="Vue grille"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-amber-100 text-amber-700' : 'text-gray-400 hover:bg-gray-100'}`}
          ><i className="bi bi-grid text-sm" /></button>
        </div>
      </div>

      {loading ? (
        <SkeletonTablePage cardCount={0} rows={10} cols={5} withToolbar={false} />
      ) : viewMode === 'list' ? (
        <div className="card p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Nom','Téléphone','Email','Nationalité','Pièce d\'identité','Séjours','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${c.is_blacklisted ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {c.first_name[0]}{c.last_name[0]}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{c.full_name}</span>
                        {c.is_blacklisted && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                            <i className="bi bi-slash-circle-fill" /> BLACKLIST
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.nationality || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{c.id_number || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-blue-50 text-blue-700 border border-blue-100">{c.bookings_count}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openDetail(c)} title="Voir les séjours" className="btn-secondary text-xs px-2 py-1"><i className="bi bi-clock-history" /></button>
                      <button onClick={() => openEdit(c)} className="btn-secondary text-xs px-2 py-1"><i className="bi bi-pencil" /></button>
                      <button
                        onClick={() => handleToggleBlacklist(c)}
                        title={c.is_blacklisted ? 'Retirer de la liste noire' : 'Mettre en liste noire'}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors font-medium ${c.is_blacklisted ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'btn-secondary'}`}
                      >
                        <i className={`bi bi-${c.is_blacklisted ? 'slash-circle-fill' : 'slash-circle'}`} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="btn-danger text-xs px-2 py-1"><i className="bi bi-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                  <i className="bi bi-people text-3xl block mb-2 opacity-40" />
                  Aucun client trouvé
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
          {clients.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
              <i className="bi bi-people text-3xl block mb-2 opacity-40" />
              Aucun client trouvé
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {clients.map(c => (
                <div key={c.id} className="card relative flex flex-col items-center text-center">
                  {c.is_blacklisted && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                      <i className="bi bi-slash-circle-fill" /> BLACKLIST
                    </span>
                  )}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base mb-2 ${c.is_blacklisted ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {c.first_name[0]}{c.last_name[0]}
                  </div>
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{c.full_name}</p>
                  <div className="mt-2 w-full text-left space-y-1 text-xs text-gray-500">
                    <p className="flex items-center gap-1.5 truncate"><i className="bi bi-telephone flex-shrink-0" />{c.phone}</p>
                    {c.email && <p className="flex items-center gap-1.5 truncate"><i className="bi bi-envelope flex-shrink-0" />{c.email}</p>}
                    {c.nationality && <p className="flex items-center gap-1.5 truncate"><i className="bi bi-flag flex-shrink-0" />{c.nationality}</p>}
                  </div>
                  <div className="mt-3 mb-3">
                    <span className="badge bg-blue-50 text-blue-700 border border-blue-100 text-xs">
                      {c.bookings_count} séjour{c.bookings_count > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex gap-1 w-full justify-center border-t border-gray-100 pt-3">
                    <button onClick={() => openDetail(c)} title="Voir les séjours" className="btn-secondary text-xs px-2 py-1"><i className="bi bi-clock-history" /></button>
                    <button onClick={() => openEdit(c)} className="btn-secondary text-xs px-2 py-1"><i className="bi bi-pencil" /></button>
                    <button
                      onClick={() => handleToggleBlacklist(c)}
                      title={c.is_blacklisted ? 'Retirer de la liste noire' : 'Mettre en liste noire'}
                      className={`text-xs px-2 py-1 rounded-lg transition-colors font-medium ${c.is_blacklisted ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'btn-secondary'}`}
                    ><i className={`bi bi-${c.is_blacklisted ? 'slash-circle-fill' : 'slash-circle'}`} /></button>
                    <button onClick={() => handleDelete(c.id)} className="btn-danger text-xs px-2 py-1"><i className="bi bi-trash" /></button>
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

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <i className="bi bi-person-vcard text-amber-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{editing ? 'Modifier le client' : 'Nouveau client'}</h3>
                  <p className="text-xs text-gray-400">{editing ? `ID #${editing.id}` : 'Remplissez les informations'}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Identité */}
              <div>
                <p className="form-section mb-3">Identité</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Prénom" icon="bi-person" error={errors.first_name} required>
                    <input value={form.first_name} onChange={set('first_name')} placeholder="Jean" autoFocus />
                  </FormField>
                  <FormField label="Nom" icon="bi-person" error={errors.last_name} required>
                    <input value={form.last_name} onChange={set('last_name')} placeholder="Dupont" />
                  </FormField>
                </div>
              </div>

              {/* Contact */}
              <div>
                <p className="form-section mb-3">Contact</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Téléphone" icon="bi-telephone" error={errors.phone} required>
                    <input type="tel" value={form.phone} placeholder="07XXXXXXXX"
                      maxLength={10} minLength={10} pattern="[0-9]{10}"
                      onChange={e => set('phone')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 10) } } as React.ChangeEvent<HTMLInputElement>)} />
                  </FormField>
                  <FormField label="Email" icon="bi-envelope" error={errors.email}>
                    <input type="email" value={form.email} onChange={set('email')} placeholder="jean@email.com" />
                  </FormField>
                </div>
                <div className="mt-3">
                  <FormField label="Nationalité" icon="bi-flag">
                    <input value={form.nationality} onChange={set('nationality')} placeholder="Ex: Ivoirienne" />
                  </FormField>
                </div>
              </div>

              {/* Pièce d'identité */}
              <div>
                <p className="form-section mb-3">Pièce d'identité</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Type de pièce" icon="bi-card-text">
                    <select value={form.id_type} onChange={set('id_type')} className="appearance-none">
                      <option value="cni">CNI</option>
                      <option value="passport">Passeport</option>
                      <option value="driver">Permis de conduire</option>
                      <option value="other">Autre</option>
                    </select>
                  </FormField>
                  <FormField label="Numéro de pièce" icon="bi-hash">
                    <input value={form.id_number} onChange={set('id_number')} placeholder="CI-2024-XXXXX" />
                  </FormField>
                </div>
              </div>

              {/* Autres */}
              <div>
                <p className="form-section mb-3">Informations complémentaires</p>
                <div className="space-y-3">
                  <FormField label="Adresse" icon="bi-geo-alt">
                    <textarea value={form.address} onChange={set('address') as React.ChangeEventHandler<HTMLTextAreaElement>}
                      placeholder="Adresse complète…" rows={2}
                      className="block w-full bg-transparent border-0 border-b-2 border-gray-200 pl-9 pr-0 py-2.5 text-sm focus:outline-none focus:ring-0 focus:border-amber-500 placeholder:text-gray-400 resize-none" />
                  </FormField>
                  <FormField label="Notes internes" icon="bi-chat-left-text">
                    <textarea value={form.notes} onChange={set('notes') as React.ChangeEventHandler<HTMLTextAreaElement>}
                      placeholder="Préférences, observations…" rows={2}
                      className="block w-full bg-transparent border-0 border-b-2 border-gray-200 pl-9 pr-0 py-2.5 text-sm focus:outline-none focus:ring-0 focus:border-amber-500 placeholder:text-gray-400 resize-none" />
                  </FormField>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary min-w-[120px] justify-center">
                  {saving ? <><i className="bi bi-arrow-repeat animate-spin" /> Enregistrement…</> : <><i className={`bi ${editing ? 'bi-check-lg' : 'bi-plus-lg'}`} />{editing ? 'Enregistrer' : 'Créer le client'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Panneau détail client (séjours + dépôts) ── */}
      {detailClient && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDetailClient(null)} />
          <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                {detailClient.first_name[0]}{detailClient.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{detailClient.full_name}</p>
                <p className="text-xs text-gray-400">{detailClient.phone} {detailClient.email && `· ${detailClient.email}`}</p>
              </div>
              <button onClick={() => setDetailClient(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading ? (
                <div className="text-center py-16 text-gray-400">
                  <i className="bi bi-arrow-repeat animate-spin text-2xl" />
                  <p className="mt-2 text-sm">Chargement…</p>
                </div>
              ) : detailBookings.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <i className="bi bi-calendar-x text-3xl" />
                  <p className="mt-2 font-medium">Aucun séjour enregistré</p>
                </div>
              ) : (
                <>
                  {/* Résumé */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Séjours', value: detailBookings.length },
                      { label: 'Total dépensé', value: formatFcfa(detailBookings.reduce((s, b) => s + Number(b.total_price), 0)) },
                      { label: 'Acomptes dus', value: formatFcfa(detailBookings.filter(b => Number(b.deposit) > 0 && !b.deposit_paid).reduce((s, b) => s + Number(b.deposit), 0)) },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                        <p className="font-bold text-gray-900 text-sm">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Liste des réservations */}
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Historique des séjours</h4>
                  <div className="space-y-3">
                    {detailBookings.map(b => (
                      <div key={b.id} className="border border-gray-100 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-mono text-xs text-gray-400">{b.reference}</p>
                            <p className="font-semibold text-gray-900 text-sm mt-0.5">
                              Chambre #{b.room_detail?.number} <span className="text-gray-400 font-normal">· {b.room_detail?.room_type_name}</span>
                            </p>
                          </div>
                          <span className={`badge border text-xs ${BOOKING_STATUS_COLORS[b.status]}`}>{b.status_display}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatDate(b.check_in)} → {formatDate(b.check_out)} · {b.nights} nuit{b.nights > 1 ? 's' : ''}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                          <p className="font-semibold text-gray-900 text-sm">{formatFcfa(Number(b.total_price))}</p>
                          {Number(b.deposit) > 0 && (
                            <span className={`text-xs flex items-center gap-1 font-medium ${b.deposit_paid ? 'text-green-600' : 'text-amber-600'}`}>
                              <i className={`bi bi-${b.deposit_paid ? 'check-circle-fill' : 'clock'}`} />
                              Acompte {b.deposit_paid ? 'encaissé' : 'dû'} {formatFcfa(Number(b.deposit))}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
