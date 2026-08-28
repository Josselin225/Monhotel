import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { inventoryApi, InventoryCategory, InventoryItem, InventoryMovement, InventoryStats } from '../api/inventory'
import { roomsApi } from '../api/rooms'
import { Room } from '../types'
import { formatFcfa, getApiError } from '../utils'
import { useAuth } from '../context/AuthContext'
import Pagination from '../components/Pagination'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'
import { useDebounce } from '../hooks/useDebounce'
import { SkeletonTablePage } from '../components/Skeleton'

const UNITS = [
  { value: 'piece', label: 'Pièce' },
  { value: 'kg',    label: 'Kilogramme' },
  { value: 'l',     label: 'Litre' },
  { value: 'pack',  label: 'Paquet' },
]
const MOVEMENT_TYPES = [
  { value: 'in',         label: 'Entrée (achat/réassort)', icon: 'bi-box-arrow-in-down', color: 'text-green-600 dark:text-green-400' },
  { value: 'out',        label: 'Sortie (consommation)',   icon: 'bi-box-arrow-up',      color: 'text-orange-600 dark:text-orange-400' },
  { value: 'adjustment', label: 'Ajustement (inventaire)', icon: 'bi-sliders',           color: 'text-blue-600 dark:text-blue-400' },
  { value: 'loss',       label: 'Perte / casse',           icon: 'bi-exclamation-triangle', color: 'text-red-600 dark:text-red-400' },
]
const CATEGORY_ICON_CHOICES = [
  'bi-cup-straw', 'bi-bag', 'bi-box-seam', 'bi-droplet', 'bi-basket', 'bi-lightbulb',
  'bi-egg-fried', 'bi-cup-hot', 'bi-brush', 'bi-tools', 'bi-three-dots',
]

const EMPTY_ITEM = { name: '', category: '', unit: 'piece', reorder_threshold: '0', unit_cost: '0', notes: '' }
const EMPTY_MOVEMENT = { item: '', movement_type: 'in', quantity: '', room: '', reason: '' }
const EMPTY_CATEGORY = { name: '', icon: 'bi-box-seam' }

export default function InventoryPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'admin' || user?.role === 'manager'
  const [tab, setTab] = useState<'items' | 'movements'>('items')

  const [items, setItems]         = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [rooms, setRooms]         = useState<Room[]>([])
  const [stats, setStats]         = useState<InventoryStats>({ total_items: 0, low_stock_count: 0, total_value: 0 })
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState({ category: '', search: '' })
  const debouncedSearch           = useDebounce(filter.search, 300)

  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem]     = useState<InventoryItem | null>(null)
  const [itemForm, setItemForm]           = useState(EMPTY_ITEM)
  const [savingItem, setSavingItem]       = useState(false)

  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveForm, setMoveForm]           = useState(EMPTY_MOVEMENT)
  const [savingMove, setSavingMove]       = useState(false)

  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [categoryForm, setCategoryForm]           = useState(EMPTY_CATEGORY)
  const [savingCategory, setSavingCategory]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page) }
      if (filter.category) params.category = filter.category
      if (debouncedSearch) params.search = debouncedSearch

      if (tab === 'items') {
        const [i, s, r, c] = await Promise.all([
          inventoryApi.listItems(params),
          inventoryApi.stats(),
          roomsApi.list({ page_size: '200' }),
          inventoryApi.listCategories(),
        ])
        setItems(i.results); setTotal(i.count); setStats(s); setRooms(r.results); setCategories(c)
      } else {
        const m = await inventoryApi.listMovements({ page: String(page) })
        setMovements(m.results); setTotal(m.count)
        if (items.length === 0) {
          const [i, c] = await Promise.all([inventoryApi.listItems({ page_size: '200' }), inventoryApi.listCategories()])
          setItems(i.results); setCategories(c)
        }
      }
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [tab, page, filter.category, debouncedSearch])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [tab, filter.category, debouncedSearch])

  const openCreateItem = () => {
    setEditingItem(null)
    setItemForm({ ...EMPTY_ITEM, category: categories[0] ? String(categories[0].id) : '' })
    setShowItemModal(true)
  }
  const openEditItem = (it: InventoryItem) => {
    setEditingItem(it)
    setItemForm({
      name: it.name, category: it.category ? String(it.category) : '', unit: it.unit,
      reorder_threshold: it.reorder_threshold, unit_cost: it.unit_cost, notes: it.notes,
    })
    setShowItemModal(true)
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingItem(true)
    try {
      const payload = { ...itemForm, category: itemForm.category ? Number(itemForm.category) : null }
      if (editingItem) {
        await inventoryApi.updateItem(editingItem.id, payload)
        toast.success('Article mis à jour')
      } else {
        await inventoryApi.createItem(payload)
        toast.success('Article créé')
      }
      setShowItemModal(false)
      load()
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setSavingItem(false) }
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingCategory(true)
    try {
      const created = await inventoryApi.createCategory(categoryForm)
      toast.success('Catégorie créée')
      setCategories(cs => [...cs, created].sort((a, b) => a.name.localeCompare(b.name)))
      setItemForm(f => ({ ...f, category: String(created.id) }))
      setShowCategoryModal(false)
      setCategoryForm(EMPTY_CATEGORY)
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setSavingCategory(false) }
  }

  const handleDeleteItem = async (it: InventoryItem) => {
    if (!confirm(`Supprimer "${it.name}" ?`)) return
    try {
      await inventoryApi.deleteItem(it.id)
      toast.success('Article supprimé')
      load()
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const openMovement = (item?: InventoryItem) => {
    setMoveForm({ ...EMPTY_MOVEMENT, item: item ? String(item.id) : '' })
    setShowMoveModal(true)
  }

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingMove(true)
    try {
      await inventoryApi.createMovement({
        item: Number(moveForm.item),
        movement_type: moveForm.movement_type,
        quantity: Number(moveForm.quantity),
        room: moveForm.room ? Number(moveForm.room) : undefined,
        reason: moveForm.reason,
      })
      toast.success('Mouvement enregistré')
      setShowMoveModal(false)
      load()
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setSavingMove(false) }
  }

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Minibar, linge, fournitures et produits d'entretien</p>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2" onClick={() => openMovement()}>
              <i className="bi bi-arrow-left-right" /> Nouveau mouvement
            </button>
            {isManager && (
              <button className="btn-primary flex items-center gap-2" onClick={openCreateItem}>
                <i className="bi bi-plus-lg" /> Nouvel article
              </button>
            )}
          </div>
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><i className="bi bi-box-seam text-blue-600 dark:text-blue-400" /></div>
          <div><p className="text-xs text-gray-400 dark:text-gray-500">Articles suivis</p><p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.total_items}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.low_stock_count > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <i className={`bi bi-exclamation-triangle ${stats.low_stock_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`} />
          </div>
          <div><p className="text-xs text-gray-400 dark:text-gray-500">Sous le seuil d'alerte</p><p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.low_stock_count}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><i className="bi bi-cash-stack text-emerald-600 dark:text-emerald-400" /></div>
          <div><p className="text-xs text-gray-400 dark:text-gray-500">Valeur du stock</p><p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatFcfa(stats.total_value)}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-100 dark:border-gray-800">
        {(['items', 'movements'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-hotel-gold text-hotel-gold' : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            {t === 'items' ? 'Articles' : 'Mouvements'}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            className="input max-w-xs" placeholder="Rechercher…"
            value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          />
          <select className="input max-w-[180px]" value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
            <option value="">Toutes catégories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <SkeletonTablePage cardCount={0} rows={8} cols={4} withToolbar={false} />
      ) : tab === 'items' ? (
        items.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500">
            <i className="bi bi-box-seam text-4xl" />
            <p className="mt-2 font-medium">Aucun article en stock</p>
          </div>
        ) : (
          <div>
            <div className="space-y-2">
              {items.map(it => (
                <div key={it.id} className={`card flex items-center gap-4 ${!it.is_active ? 'opacity-50' : ''}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${it.is_low_stock ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                    <i className={`bi ${it.category_icon ?? 'bi-box'} text-lg`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{it.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">{it.category_name ?? '—'}</span>
                      {it.is_low_stock && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 font-medium">Stock bas</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Seuil d'alerte : {it.reorder_threshold} {it.unit_display} · Coût unitaire : {formatFcfa(Number(it.unit_cost))}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold ${it.is_low_stock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{it.quantity_on_hand}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{it.unit_display}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-hotel-gold transition-colors"
                      title="Enregistrer un mouvement" onClick={() => openMovement(it)}>
                      <i className="bi bi-arrow-left-right" />
                    </button>
                    {isManager && (
                      <>
                        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                          onClick={() => openEditItem(it)}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          onClick={() => handleDeleteItem(it)}>
                          <i className="bi bi-trash" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={page} total={total} onChange={setPage} />
          </div>
        )
      ) : (
        movements.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500">
            <i className="bi bi-arrow-left-right text-4xl" />
            <p className="mt-2 font-medium">Aucun mouvement enregistré</p>
          </div>
        ) : (
          <div>
            <div className="space-y-2">
              {movements.map(mv => {
                const mt = MOVEMENT_TYPES.find(t => t.value === mv.movement_type)
                return (
                  <div key={mv.id} className="card flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 ${mt?.color ?? ''}`}>
                      <i className={`bi ${mt?.icon ?? 'bi-arrow-left-right'} text-lg`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{mv.item_name ?? 'Article supprimé'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {mt?.label} {mv.room_number && `· Chambre ${mv.room_number}`} {mv.reason && `· ${mv.reason}`}
                        {mv.created_by_name && ` · par ${mv.created_by_name}`}
                      </p>
                    </div>
                    <div className={`text-lg font-bold shrink-0 ${mt?.color ?? ''}`}>
                      {mv.movement_type === 'in' ? '+' : mv.movement_type === 'adjustment' ? '=' : '-'}{mv.quantity} {mv.item_unit}
                    </div>
                  </div>
                )
              })}
            </div>
            <Pagination page={page} total={total} onChange={setPage} />
          </div>
        )
      )}

      {/* Modal article */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-5">
              {editingItem ? "Modifier l'article" : 'Nouvel article'}
            </h3>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <FormField label="Nom" icon="bi-tag" required>
                <input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Coca-Cola 33cl" required />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Catégorie" required>
                  <div className="flex gap-1.5">
                    <select value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))} required className="flex-1">
                      <option value="">Sélectionner…</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button type="button" title="Nouvelle catégorie"
                      onClick={() => setShowCategoryModal(true)}
                      className="shrink-0 w-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-hotel-gold hover:border-hotel-gold transition-colors flex items-center justify-center">
                      <i className="bi bi-plus-lg" />
                    </button>
                  </div>
                </FormField>
                <FormField label="Unité">
                  <select value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Seuil d'alerte" icon="bi-exclamation-triangle">
                  <input type="number" min="0" step="0.01" value={itemForm.reorder_threshold}
                    onChange={e => setItemForm(f => ({ ...f, reorder_threshold: e.target.value }))} />
                </FormField>
                <FormField label="Coût unitaire (FCFA)" icon="bi-cash">
                  <input type="number" min="0" step="0.01" value={itemForm.unit_cost}
                    onChange={e => setItemForm(f => ({ ...f, unit_cost: e.target.value }))} />
                </FormField>
              </div>
              <FormField label="Notes" icon="bi-card-text">
                <textarea value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-ghost" onClick={() => setShowItemModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={savingItem}>
                  {savingItem ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal mouvement */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-5">Nouveau mouvement de stock</h3>
            <form onSubmit={handleSaveMovement} className="space-y-4">
              <FormField label="Article" icon="bi-box-seam" required>
                <select value={moveForm.item} onChange={e => setMoveForm(f => ({ ...f, item: e.target.value }))} required>
                  <option value="">Sélectionner…</option>
                  {items.map(it => <option key={it.id} value={it.id}>{it.name} ({it.quantity_on_hand} {it.unit_display})</option>)}
                </select>
              </FormField>
              <FormField label="Type de mouvement">
                <select value={moveForm.movement_type} onChange={e => setMoveForm(f => ({ ...f, movement_type: e.target.value }))}>
                  {MOVEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Quantité" icon="bi-123" required>
                  <input type="number" min="0.01" step="0.01" value={moveForm.quantity}
                    onChange={e => setMoveForm(f => ({ ...f, quantity: e.target.value }))} required />
                </FormField>
                <FormField label="Chambre (minibar, optionnel)" icon="bi-door-open">
                  <select value={moveForm.room} onChange={e => setMoveForm(f => ({ ...f, room: e.target.value }))}>
                    <option value="">—</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.number}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Motif" icon="bi-card-text">
                <input value={moveForm.reason} onChange={e => setMoveForm(f => ({ ...f, reason: e.target.value }))} placeholder="ex: Réassort fournisseur" />
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-ghost" onClick={() => setShowMoveModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={savingMove}>
                  {savingMove ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal nouvelle catégorie */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-5">Nouvelle catégorie</h3>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <FormField label="Nom" icon="bi-tag" required>
                <input value={categoryForm.name} onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ex: Boissons alcoolisées" required autoFocus />
              </FormField>
              <div>
                <label className="label">Icône</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {CATEGORY_ICON_CHOICES.map(icon => (
                    <button key={icon} type="button" onClick={() => setCategoryForm(f => ({ ...f, icon }))}
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${categoryForm.icon === icon ? 'border-hotel-gold bg-amber-50 dark:bg-amber-900/20 text-hotel-gold' : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                      <i className={`bi ${icon}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-ghost" onClick={() => setShowCategoryModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={savingCategory}>
                  {savingCategory ? 'Enregistrement…' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
