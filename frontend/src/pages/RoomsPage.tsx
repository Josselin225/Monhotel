import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { roomsApi } from '../api/rooms'
import { Room, RoomType } from '../types'
import { ROOM_STATUS_COLORS, formatFcfa, getApiError } from '../utils'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import { SkeletonRoomsGrid } from '../components/Skeleton'

const STATUS_OPTIONS = [
  { value: 'available',   label: 'Disponible' },
  { value: 'occupied',    label: 'Occupée' },
  { value: 'maintenance', label: 'En maintenance' },
  { value: 'cleaning',    label: 'En nettoyage' },
]

const STATUS_ICONS: Record<string, string> = {
  available: 'bi-check-circle text-green-500',
  occupied: 'bi-person-fill text-red-500',
  maintenance: 'bi-tools text-yellow-500',
  cleaning: 'bi-stars text-blue-500',
}


const roomSchema = z.object({
  number:         z.string().min(1, 'Numéro requis'),
  room_type:      z.number().positive('Type de chambre requis'),
  floor:          z.number().min(0),
  status:         z.string(),
  price_override: z.number().positive().nullable(),
  notes:          z.string(),
})

type FormErrors = Partial<Record<keyof z.infer<typeof roomSchema>, string>>
type ViewMode = 'list' | 'table'
type Tab = 'rooms' | 'types'

const typeSchema = z.object({
  name:        z.string().min(1, 'Nom requis'),
  description: z.string(),
  base_price:  z.number().positive('Prix requis'),
  capacity:    z.number().int().min(1, 'Min 1 personne'),
})
type TypeFormErrors = Partial<Record<keyof z.infer<typeof typeSchema>, string>>

export default function RoomsPage() {
  const queryClient               = useQueryClient()
  const [tab, setTab]             = useState<Tab>('rooms')
  const [page, setPage]           = useState(1)
  const [filter, setFilter]       = useState({ status: '', search: '' })
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Room | null>(null)
  const [form, setForm]           = useState({ number: '', room_type: '', floor: '0', status: 'available', price_override: '', notes: '' })
  const [errors, setErrors]       = useState<FormErrors>({})
  const [saving, setSaving]       = useState(false)
  const [viewMode, setViewMode]   = useState<ViewMode>('table')

  // ── Types de chambres ────────────────────────────────────────────
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editingType, setEditingType]     = useState<RoomType | null>(null)
  const [typeForm, setTypeForm]           = useState({ name: '', description: '', base_price: '', capacity: '2', hourly_rate: '', amenities: [] as string[] })
  const [tagInput, setTagInput]           = useState('')
  const [typeErrors, setTypeErrors]       = useState<TypeFormErrors>({})
  const [typeSaving, setTypeSaving]       = useState(false)

  useEffect(() => { setPage(1) }, [filter])

  const { data: roomsData, isLoading: loading } = useQuery({
    queryKey: ['rooms', filter.status, filter.search, page],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page) }
      if (filter.status) params.status = filter.status
      if (filter.search) params.search = filter.search
      const [r, t] = await Promise.all([roomsApi.list(params), roomsApi.listTypes()])
      return { rooms: r.results, total: r.count, types: t.results }
    },
  })

  const rooms = roomsData?.rooms ?? []
  const types = roomsData?.types ?? []
  const total = roomsData?.total ?? 0

  const invalidate     = () => queryClient.invalidateQueries({ queryKey: ['rooms'] })
  const invalidateTypes = () => queryClient.invalidateQueries({ queryKey: ['roomTypes'] })

  // ── Query types (onglet Types) ────────────────────────────────────
  const { data: allTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: async () => {
      const r = await roomsApi.listTypes()
      return r.results
    },
    staleTime: 5 * 60_000,
  })

  // ── CRUD handlers types ────────────────────────────────────────────
  const openCreateType = () => {
    setEditingType(null)
    setTypeForm({ name: '', description: '', base_price: '', capacity: '2', hourly_rate: '', amenities: [] })
    setTagInput('')
    setTypeErrors({})
    setShowTypeModal(true)
  }
  const openEditType = (t: RoomType) => {
    setEditingType(t)
    setTypeForm({ name: t.name, description: t.description, base_price: String(t.base_price), capacity: String(t.capacity), hourly_rate: t.hourly_rate != null ? String(t.hourly_rate) : '', amenities: [...(t.amenities ?? [])] })
    setTagInput('')
    setTypeErrors({})
    setShowTypeModal(true)
  }
  const handleDeleteType = async (id: number) => {
    if (!confirm('Supprimer ce type ? Les chambres rattachées seront aussi affectées.')) return
    try {
      await roomsApi.deleteType(id)
      toast.success('Type supprimé')
      invalidateTypes()
      invalidate()
    } catch (err) { toast.error(getApiError(err)) }
  }
  const addTag = () => {
    const tag = tagInput.trim().replace(/,$/, '')
    if (tag && !typeForm.amenities.includes(tag)) {
      setTypeForm(f => ({ ...f, amenities: [...f.amenities, tag] }))
    }
    setTagInput('')
  }
  const removeTag = (tag: string) =>
    setTypeForm(f => ({ ...f, amenities: f.amenities.filter(a => a !== tag) }))

  const handleTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = typeSchema.safeParse({
      name:        typeForm.name,
      description: typeForm.description,
      base_price:  Number(typeForm.base_price) || undefined,
      capacity:    Number(typeForm.capacity) || undefined,
    })
    if (!parsed.success) {
      const errs: TypeFormErrors = {}
      parsed.error.issues.forEach((i: z.ZodIssue) => { if (i.path[0]) errs[i.path[0] as keyof TypeFormErrors] = i.message })
      setTypeErrors(errs); return
    }
    setTypeSaving(true)
    try {
      const payload = { ...parsed.data, amenities: typeForm.amenities, hourly_rate: typeForm.hourly_rate ? Number(typeForm.hourly_rate) : null }
      if (editingType) {
        await roomsApi.updateType(editingType.id, payload)
        toast.success('Type mis à jour')
      } else {
        await roomsApi.createType(payload)
        toast.success('Type créé')
      }
      setShowTypeModal(false)
      invalidateTypes()
      invalidate()
    } catch (err) { toast.error(getApiError(err))
    } finally { setTypeSaving(false) }
  }

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(err => ({ ...err, [field]: undefined }))
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ number: '', room_type: '', floor: '0', status: 'available', price_override: '', notes: '' })
    setErrors({}); setShowModal(true)
  }
  const openEdit = (room: Room) => {
    setEditing(room)
    setForm({
      number: room.number, room_type: String(room.room_type),
      floor: String(room.floor), status: room.status,
      price_override: room.price_override ? String(room.price_override) : '',
      notes: room.notes,
    })
    setErrors({}); setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = roomSchema.safeParse({
      number: form.number,
      room_type: Number(form.room_type) || undefined,
      floor: Number(form.floor),
      status: form.status,
      price_override: form.price_override ? Number(form.price_override) : null,
      notes: form.notes,
    })
    if (!parsed.success) {
      const errs: FormErrors = {}
      parsed.error.issues.forEach((e: z.ZodIssue) => { if (e.path[0]) errs[e.path[0] as keyof FormErrors] = e.message })
      setErrors(errs); return
    }
    setSaving(true)
    try {
      if (editing) {
        await roomsApi.update(editing.id, parsed.data as Partial<Room>)
        toast.success('Chambre mise à jour')
      } else {
        await roomsApi.create(parsed.data as Partial<Room>)
        toast.success('Chambre créée')
      }
      setShowModal(false); invalidate()
    } catch (err) { toast.error(getApiError(err))
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette chambre ?')) return
    try {
      await roomsApi.delete(id); toast.success('Chambre supprimée'); invalidate()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const changeStatus = async (room: Room, status: string) => {
    try {
      await roomsApi.update(room.id, { status } as Partial<Room>)
      toast.success('Statut mis à jour')
      invalidate()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const counts = STATUS_OPTIONS.map(s => ({ ...s, count: rooms.filter(r => r.status === s.value).length }))

  const filteredRooms = rooms

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700 font-medium">
            {tab === 'rooms' ? `${total} chambre${total > 1 ? 's' : ''}` : `${allTypes.length} type${allTypes.length > 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Onglets */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
              <button onClick={() => setTab('rooms')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'rooms' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                <i className="bi bi-door-open text-sm" /> Chambres
              </button>
              <button onClick={() => setTab('types')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'types' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                <i className="bi bi-layers text-sm" /> Types
              </button>
            </div>
            {/* Vue (chambres seulement) */}
            {tab === 'rooms' && (
              <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
                <button onClick={() => setViewMode('list')} title="Vue liste" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                  <i className="bi bi-list-ul text-sm" /> Liste
                </button>
                <button onClick={() => setViewMode('table')} title="Vue tableau" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'table' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                  <i className="bi bi-table text-sm" /> Tableau
                </button>
              </div>
            )}
            {tab === 'rooms'
              ? <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm"><i className="bi bi-plus-lg" /> Nouvelle chambre</button>
              : <button onClick={openCreateType} className="btn-primary flex items-center gap-2 text-sm"><i className="bi bi-plus-lg" /> Nouveau type</button>
            }
          </div>
        </div>
      </PageHeader>

      {/* ── Onglet Chambres ── */}
      {tab === 'rooms' && <>

      {/* Filters */}
      <div className="card mb-4 flex flex-col gap-3 sm:flex-row sm:items-center py-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <i className="bi bi-search text-gray-400" />
          <input type="text" placeholder="Numéro, type…" className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
            value={filter.search} onChange={e => setFilter({...filter, search: e.target.value})} />
        </div>
        <select className="input-box w-full sm:w-52" value={filter.status} onChange={e => setFilter({...filter, status: e.target.value})}>
          <option value="">Tous les statuts</option>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Status chips */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {counts.map(s => (
          <button key={s.value} onClick={() => setFilter(f => ({...f, status: f.status === s.value ? '' : s.value}))}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${ROOM_STATUS_COLORS[s.value]} ${filter.status === s.value ? 'ring-2 ring-offset-1 ring-current opacity-100' : 'opacity-80 hover:opacity-100'}`}>
            <i className={`bi ${STATUS_ICONS[s.value]}`} />
            {s.label} <strong>({s.count})</strong>
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonRoomsGrid count={12} />
      ) : viewMode === 'list' ? (
        /* ── LIST VIEW ── */
        <div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRooms.map(room => (
              <RoomCard key={room.id} room={room} onEdit={openEdit} onDelete={handleDelete} onChangeStatus={changeStatus} />
            ))}
            {filteredRooms.length === 0 && (
              <div className="col-span-full py-16 text-center text-gray-400">
                <i className="bi bi-door-open text-4xl block mb-2 opacity-40" />
                Aucune chambre trouvée
              </div>
            )}
          </div>
          <Pagination page={page} total={total} pageSize={10} onChange={setPage} />
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Chambre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Étage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Prix / nuit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRooms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-400">
                      <i className="bi bi-door-open text-3xl block mb-2 opacity-40" />
                      Aucune chambre trouvée
                    </td>
                  </tr>
                ) : filteredRooms.map(room => (
                  <tr key={room.id} className="hover:bg-gray-50/70 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900 text-base">#{room.number}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{room.room_type_name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{room.floor_display}</td>
                    <td className="px-4 py-3">
                      <select
                        className={`badge border text-xs font-medium cursor-pointer pr-6 bg-transparent appearance-none ${ROOM_STATUS_COLORS[room.status]}`}
                        value={room.status}
                        onChange={e => changeStatus(room, e.target.value)}
                      >
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600">{formatFcfa(Number(room.price))}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(room)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors" title="Modifier">
                          <i className="bi bi-pencil text-xs" />
                        </button>
                        <button onClick={() => handleDelete(room.id)} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors" title="Supprimer">
                          <i className="bi bi-trash text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-2">
            <Pagination page={page} total={total} pageSize={10} onChange={setPage} />
          </div>
        </div>
      )}

      </>}

      {/* ── Onglet Types de chambres ── */}
      {tab === 'types' && (
        typesLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
            <i className="bi bi-arrow-repeat animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allTypes.length === 0 && (
              <div className="col-span-full py-16 text-center text-gray-400">
                <i className="bi bi-layers text-4xl block mb-2 opacity-40" />
                Aucun type de chambre. Créez-en un.
              </div>
            )}
            {allTypes.map(t => (
              <div key={t.id} className="card hover:shadow-md transition-all hover:-translate-y-0.5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-lg leading-tight truncate">{t.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <i className="bi bi-people mr-1" />{t.capacity} pers. ·{' '}
                      <i className="bi bi-door-open mr-1" />{t.rooms_count} chambre{t.rooms_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <button onClick={() => openEditType(t)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors" title="Modifier">
                      <i className="bi bi-pencil text-xs" />
                    </button>
                    <button onClick={() => handleDeleteType(t.id)} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors" title="Supprimer">
                      <i className="bi bi-trash text-xs" />
                    </button>
                  </div>
                </div>
                {t.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{t.description}</p>}
                {t.hourly_rate != null ? (
                  <div className="mb-3">
                    <p className="text-xl font-bold text-amber-600">{formatFcfa(Number(t.hourly_rate))}<span className="text-xs font-normal text-gray-400"> /heure</span></p>
                    <span className="inline-flex items-center gap-1 mt-0.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5"><i className="bi bi-clock-fill text-[10px]" /> Passage</span>
                  </div>
                ) : (
                  <p className="text-xl font-bold text-amber-600 mb-3">{formatFcfa(Number(t.base_price))}<span className="text-xs font-normal text-gray-400"> /nuit</span></p>
                )}
                {(t.amenities ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(t.amenities ?? []).map(a => (
                      <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-100">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Modale type de chambre ── */}
      {showTypeModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTypeModal(false)}>
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <i className="bi bi-layers text-amber-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{editingType ? editingType.name : 'Nouveau type'}</h3>
                  <p className="text-xs text-gray-400">{editingType ? 'Modifier le type' : 'Créer un type de chambre'}</p>
                </div>
              </div>
              <button onClick={() => setShowTypeModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            <form onSubmit={handleTypeSubmit} className="p-6 space-y-5">
              <FormField label="Nom du type" icon="bi-tag" error={typeErrors.name} required>
                <input value={typeForm.name} onChange={e => { setTypeForm(f => ({...f, name: e.target.value})); setTypeErrors(er => ({...er, name: undefined})) }} placeholder="Suite Junior, Standard…" autoFocus />
              </FormField>

              <FormField label="Description" icon="bi-card-text">
                <textarea value={typeForm.description}
                  onChange={e => setTypeForm(f => ({...f, description: e.target.value}))}
                  placeholder="Décrivez ce type de chambre…" rows={2}
                  className="block w-full bg-transparent border-0 border-b-2 border-gray-200 pl-9 pr-0 py-2.5 text-sm focus:outline-none focus:ring-0 focus:border-amber-500 placeholder:text-gray-400 resize-none" />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Prix de base (FCFA)" icon="bi-currency-exchange" error={typeErrors.base_price} required>
                  <input type="number" min="0" value={typeForm.base_price} onChange={e => { setTypeForm(f => ({...f, base_price: e.target.value})); setTypeErrors(er => ({...er, base_price: undefined})) }} placeholder="25000" />
                </FormField>
                <FormField label="Capacité (pers.)" icon="bi-people" error={typeErrors.capacity} required>
                  <input type="number" min="1" max="20" value={typeForm.capacity} onChange={e => { setTypeForm(f => ({...f, capacity: e.target.value})); setTypeErrors(er => ({...er, capacity: undefined})) }} />
                </FormField>
              </div>
              <FormField label="Tarif horaire (FCFA)" icon="bi-clock" hint="Laisser vide si ce type ne se loue pas à l'heure">
                <input type="number" min="0" value={typeForm.hourly_rate} onChange={e => setTypeForm(f => ({...f, hourly_rate: e.target.value}))} placeholder="Optionnel — pour les chambres de passage" />
              </FormField>

              {/* Équipements tag input */}
              <div>
                <p className="form-section mb-2">Équipements / services inclus</p>
                {typeForm.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {typeForm.amenities.map(a => (
                      <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-100">
                        {a}
                        <button type="button" onClick={() => removeTag(a)} className="text-amber-400 hover:text-amber-600 leading-none">
                          <i className="bi bi-x text-[10px]" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 border-b-2 border-gray-200 focus-within:border-amber-500 pb-1">
                  <i className="bi bi-star text-gray-400 text-sm" />
                  <input
                    type="text" value={tagInput} placeholder="Ajouter un équipement… (Entrée pour valider)"
                    className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
                  />
                  {tagInput && (
                    <button type="button" onClick={addTag} className="text-xs text-amber-600 hover:text-amber-700 font-medium">Ajouter</button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">Ex : Wi-Fi, Climatisation, Balcon, Jacuzzi…</p>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowTypeModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={typeSaving} className="btn-primary min-w-[120px] justify-center">
                  {typeSaving ? <><i className="bi bi-arrow-repeat animate-spin" /> Enregistrement…</> : <><i className={`bi ${editingType ? 'bi-check-lg' : 'bi-plus-lg'}`} />{editingType ? 'Enregistrer' : 'Créer'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box max-w-lg">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <i className="bi bi-door-open text-blue-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{editing ? `Chambre #${editing.number}` : 'Nouvelle chambre'}</h3>
                  <p className="text-xs text-gray-400">{editing ? 'Modifier les informations' : 'Ajouter une chambre'}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <p className="form-section mb-3">Identification</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Numéro" icon="bi-hash" error={errors.number} required>
                    <input value={form.number} onChange={set('number')} placeholder="101" autoFocus />
                  </FormField>
                  <FormField label="Étage" icon="bi-building">
                    <select value={form.floor} onChange={set('floor')} className="appearance-none">
                      {[0,1,2,3,4].map(f => <option key={f} value={f}>{f === 0 ? 'Rez-de-chaussée' : `${f}${f===1?'er':'ème'} étage`}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="mt-3">
                  <FormField label="Type de chambre" icon="bi-layers" error={errors.room_type} required>
                    <select value={form.room_type} onChange={set('room_type')} className="appearance-none">
                      <option value="">Sélectionner un type…</option>
                      {types.map(t => <option key={t.id} value={t.id}>{t.name} — {formatFcfa(Number(t.base_price))}</option>)}
                    </select>
                  </FormField>
                </div>
              </div>

              <div>
                <p className="form-section mb-3">Statut et tarif</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Statut" icon="bi-circle-fill">
                    <select value={form.status} onChange={set('status')} className="appearance-none">
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Prix personnalisé (FCFA)" icon="bi-currency-exchange" hint="Laisser vide = prix du type">
                    <input type="number" value={form.price_override} onChange={set('price_override')} placeholder="Prix du type par défaut" />
                  </FormField>
                </div>
              </div>

              <div>
                <p className="form-section mb-3">Notes</p>
                <FormField label="Observations internes" icon="bi-chat-left-text">
                  <textarea value={form.notes} onChange={set('notes') as React.ChangeEventHandler<HTMLTextAreaElement>}
                    placeholder="Équipements spéciaux, état de la chambre…" rows={3}
                    className="block w-full bg-transparent border-0 border-b-2 border-gray-200 pl-9 pr-0 py-2.5 text-sm focus:outline-none focus:ring-0 focus:border-amber-500 placeholder:text-gray-400 resize-none" />
                </FormField>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary min-w-[120px] justify-center">
                  {saving ? <><i className="bi bi-arrow-repeat animate-spin" /> Enregistrement…</> : <><i className={`bi ${editing ? 'bi-check-lg' : 'bi-plus-lg'}`} />{editing ? 'Enregistrer' : 'Créer'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function RoomCard({ room, onEdit, onDelete, onChangeStatus }: {
  room: Room
  onEdit: (r: Room) => void
  onDelete: (id: number) => void
  onChangeStatus: (r: Room, s: string) => void
}) {
  return (
    <div className="card hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-2xl font-bold text-gray-900">#{room.number}</p>
          <p className="text-sm text-gray-500">{room.room_type_name}</p>
        </div>
        <span className={`flex items-center gap-1.5 badge border text-xs ${ROOM_STATUS_COLORS[room.status]}`}>
          <i className={`bi ${STATUS_ICONS[room.status]}`} />
          {room.status_display}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-1"><i className="bi bi-building mr-1" />{room.floor_display}</p>
      <p className="text-base font-bold text-amber-600 mb-4">{formatFcfa(Number(room.price))}</p>
      <div className="flex gap-2 flex-wrap">
        <select className="flex-1 input-box text-xs py-1.5 px-2"
          value={room.status} onChange={e => onChangeStatus(room, e.target.value)}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={() => onEdit(room)}       className="btn-secondary text-xs px-2 py-1.5"><i className="bi bi-pencil" /></button>
        <button onClick={() => onDelete(room.id)} className="btn-danger text-xs px-2 py-1.5"><i className="bi bi-trash" /></button>
      </div>
    </div>
  )
}

