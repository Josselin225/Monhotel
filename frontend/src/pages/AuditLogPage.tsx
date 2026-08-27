import { useState, useEffect, useCallback, Fragment } from 'react'
import { toast } from 'sonner'
import { auditLogApi, AuditEntry, ACTION_COLORS, MODEL_NAMES } from '../api/auditLog'
import { getApiError } from '../utils'
import { useAuth } from '../context/AuthContext'
import Pagination from '../components/Pagination'
import PageHeader from '../components/PageHeader'
import { useDebounce } from '../hooks/useDebounce'
import { SkeletonTablePage } from '../components/Skeleton'

function formatDateTime(dt: string) {
  try {
    const d = new Date(dt)
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return dt }
}

function formatValue(v: unknown) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  return String(v)
}

function isDiff(v: unknown): v is [unknown, unknown] {
  return Array.isArray(v) && v.length === 2
}

const EMPTY_FILTER = { action: '', model_name: '', search: '', date_from: '', date_to: '' }

export default function AuditLogPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState(EMPTY_FILTER)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const debouncedSearch       = useDebounce(filter.search, 300)

  const buildParams = useCallback((): Record<string, string> => {
    const params: Record<string, string> = {}
    if (filter.action)     params.action     = filter.action
    if (filter.model_name) params.model_name = filter.model_name
    if (debouncedSearch)   params.search     = debouncedSearch
    if (filter.date_from)  params.date_from  = filter.date_from
    if (filter.date_to)    params.date_to    = filter.date_to
    return params
  }, [filter.action, filter.model_name, debouncedSearch, filter.date_from, filter.date_to])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await auditLogApi.list({ ...buildParams(), page: String(page) })
      setEntries(data.results)
      setTotal(data.count)
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [buildParams, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [filter.action, filter.model_name, debouncedSearch, filter.date_from, filter.date_to])

  const handleClear = async () => {
    setClearing(true)
    try {
      const { deleted } = await auditLogApi.clear()
      toast.success(`Journal vidé (${deleted} entrée${deleted > 1 ? 's' : ''} supprimée${deleted > 1 ? 's' : ''})`)
      setShowClearConfirm(false)
      setPage(1)
      load()
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setClearing(false) }
  }

  const ACTION_ICONS: Record<string, string> = {
    create: 'bi-plus-circle-fill',
    update: 'bi-pencil-fill',
    delete: 'bi-trash-fill',
    login:  'bi-box-arrow-in-right',
    logout: 'bi-box-arrow-left',
    view:   'bi-eye-fill',
    other:  'bi-three-dots',
  }

  const hasFilters = filter.action || filter.model_name || filter.search || filter.date_from || filter.date_to
  const changeCount = (e: AuditEntry) => Object.keys(e.changes || {}).length

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700 font-medium">{total} entrée{total > 1 ? 's' : ''}</p>
          <div className="flex items-center gap-2">
            <a
              href={auditLogApi.exportUrl(buildParams())}
              className="btn-secondary text-sm px-3 py-2 flex items-center gap-1.5 w-fit"
            >
              <i className="bi bi-download" /> Exporter (CSV)
            </a>
            {isAdmin && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-sm px-3 py-2 flex items-center gap-1.5 w-fit text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <i className="bi bi-trash3" /> Vider le journal
              </button>
            )}
          </div>
        </div>
      </PageHeader>

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <i className="bi bi-exclamation-triangle text-red-600 text-lg" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Vider tout le journal d'audit ?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Toutes les {total} entrée{total > 1 ? 's' : ''} seront définitivement supprimées. Cette action est irréversible
              et sera elle-même consignée dans le journal.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setShowClearConfirm(false)} disabled={clearing}>Annuler</button>
              <button className="btn-danger" onClick={handleClear} disabled={clearing}>
                {clearing ? 'Suppression…' : 'Vider le journal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-4 space-y-3 py-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <i className="bi bi-search text-gray-400" />
            <input type="text" placeholder="Objet, description…"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
              value={filter.search} onChange={e => setFilter(f => ({...f, search: e.target.value}))} />
            {filter.search && <button onClick={() => setFilter(f => ({...f, search: ''}))} className="text-gray-400 hover:text-gray-600"><i className="bi bi-x" /></button>}
          </div>
          <select className="input-box w-full sm:w-44" value={filter.action} onChange={e => setFilter(f => ({...f, action: e.target.value}))}>
            <option value="">Toutes les actions</option>
            <option value="create">Création</option>
            <option value="update">Modification</option>
            <option value="delete">Suppression</option>
            <option value="login">Connexion</option>
            <option value="logout">Déconnexion</option>
            <option value="view">Consultation</option>
          </select>
          <select className="input-box w-full sm:w-48" value={filter.model_name} onChange={e => setFilter(f => ({...f, model_name: e.target.value}))}>
            <option value="">Tous les modules</option>
            {MODEL_NAMES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-gray-400 shrink-0">Du</label>
            <input type="date" className="input-box w-full" value={filter.date_from}
              onChange={e => setFilter(f => ({...f, date_from: e.target.value}))} />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-gray-400 shrink-0">Au</label>
            <input type="date" className="input-box w-full" value={filter.date_to}
              onChange={e => setFilter(f => ({...f, date_to: e.target.value}))} />
          </div>
          {hasFilters && (
            <button onClick={() => setFilter(EMPTY_FILTER)} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 shrink-0">
              <i className="bi bi-x-circle" /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonTablePage cardCount={0} rows={12} cols={6} withToolbar={false} />
      ) : (
        <div className="card p-0 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date','Utilisateur','Action','Module','Objet','IP',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map(e => {
                const nChanges = changeCount(e)
                const canExpand = nChanges > 0
                const isOpen = expanded === e.id
                return (
                  <Fragment key={e.id}>
                    <tr
                      className={`transition-colors ${canExpand ? 'cursor-pointer hover:bg-gray-50/60' : ''}`}
                      onClick={() => canExpand && setExpanded(isOpen ? null : e.id)}
                    >
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold shrink-0">
                            {e.username?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">{e.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge border flex items-center gap-1 w-fit ${ACTION_COLORS[e.action]}`}>
                          <i className={`bi ${ACTION_ICONS[e.action] ?? 'bi-three-dots'} text-[10px]`} />
                          {e.action_display}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{e.model_name || '—'}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700 truncate max-w-[220px]">
                          {e.object_repr}
                          {e.object_id && <span className="text-gray-300 font-mono text-xs ml-1.5">#{e.object_id}</span>}
                        </p>
                        {e.description && <p className="text-xs text-gray-400 truncate max-w-[220px]">{e.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{e.ip_address ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">
                        {canExpand && (
                          <span className="flex items-center gap-1">
                            {nChanges} champ{nChanges > 1 ? 's' : ''}
                            <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'} text-[10px]`} />
                          </span>
                        )}
                      </td>
                    </tr>
                    {isOpen && canExpand && (
                      <tr key={`${e.id}-detail`} className="bg-gray-50/60">
                        <td colSpan={7} className="px-4 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-400">
                                <th className="text-left font-medium pb-1.5 pr-4">Champ</th>
                                {e.action === 'delete' ? (
                                  <th className="text-left font-medium pb-1.5">Valeur au moment de la suppression</th>
                                ) : (
                                  <>
                                    <th className="text-left font-medium pb-1.5 pr-4">Avant</th>
                                    <th className="text-left font-medium pb-1.5">Après</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(e.changes).map(([field, value]) => (
                                <tr key={field} className="border-t border-gray-100">
                                  <td className="py-1.5 pr-4 font-medium text-gray-600 whitespace-nowrap">{field}</td>
                                  {isDiff(value) ? (
                                    <>
                                      <td className="py-1.5 pr-4 text-red-500 line-through decoration-red-300">{formatValue(value[0])}</td>
                                      <td className="py-1.5 text-green-600 font-medium">{formatValue(value[1])}</td>
                                    </>
                                  ) : (
                                    <td className="py-1.5 text-gray-600" colSpan={2}>{formatValue(value)}</td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {entries.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                  <i className="bi bi-journal-text text-3xl block mb-2 opacity-30" />
                  Aucune entrée dans le journal
                </td></tr>
              )}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={page} total={total} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}
