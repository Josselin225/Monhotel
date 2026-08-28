import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { housekeepingApi, CleaningTask, CleaningStats } from '../api/housekeeping'
import { getApiError, formatDate } from '../utils'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import { useDebounce } from '../hooks/useDebounce'
import { SkeletonRoomsGrid } from '../components/Skeleton'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:     { label: 'À nettoyer',  color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',    icon: 'bi-exclamation-circle' },
  in_progress: { label: 'En cours',   color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', icon: 'bi-arrow-repeat' },
  done:        { label: 'Terminé',    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',   icon: 'bi-check-circle' },
  inspected:   { label: 'Inspecté',   color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300', icon: 'bi-patch-check' },
}

const PRIORITY_CONFIG: Record<string, string> = {
  normal: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  urgent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
}

export default function HousekeepingPage() {
  const [tasks, setTasks]     = useState<CleaningTask[]>([])
  const [stats, setStats]     = useState<CleaningStats | null>(null)
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState({ status: '', search: '' })
  const debouncedSearch       = useDebounce(filter.search, 300)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page) }
      if (filter.status)   params.status = filter.status
      if (debouncedSearch) params.search = debouncedSearch
      const [t, s] = await Promise.all([
        housekeepingApi.list(params),
        housekeepingApi.stats(),
      ])
      setTasks(t.results)
      setTotal(t.count)
      setStats(s)
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setLoading(false) }
  }, [filter.status, debouncedSearch, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [filter.status, debouncedSearch])

  const handleSync = async () => {
    try {
      const res = await housekeepingApi.sync()
      toast.success(res.detail)
      await load()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const handleAction = async (action: 'start' | 'complete' | 'inspect', id: number) => {
    try {
      const updated = await housekeepingApi[action](id)
      setTasks(t => t.map(task => task.id === id ? updated : task))
      setStats(s => s ? { ...s, [updated.status]: (s[updated.status as keyof CleaningStats] ?? 0) + 1 } : s)
      toast.success(action === 'start' ? 'Nettoyage démarré' : action === 'complete' ? 'Chambre nettoyée — remise à disposition' : 'Tâche inspectée')
      await load()
    } catch (err) { toast.error(getApiError(err)) }
  }

  const pending     = tasks.filter(t => t.status === 'pending').length
  const in_progress = tasks.filter(t => t.status === 'in_progress').length
  const done        = tasks.filter(t => t.status === 'done').length

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Gestion des tâches de nettoyage</p>
          <div className="flex gap-2">
            <button onClick={handleSync} className="btn-primary flex items-center gap-2">
              <i className="bi bi-arrow-repeat" /> Synchroniser les chambres
            </button>
            <button onClick={load} className="btn-secondary flex items-center gap-2">
              <i className="bi bi-arrow-clockwise" /> Actualiser
            </button>
          </div>
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'À nettoyer',  value: stats?.pending ?? pending,     color: 'text-red-600 dark:text-red-400',   icon: 'bi-exclamation-circle' },
          { label: 'En cours',    value: stats?.in_progress ?? in_progress, color: 'text-amber-600 dark:text-amber-400', icon: 'bi-arrow-repeat' },
          { label: 'Terminées',   value: stats?.done ?? done,           color: 'text-blue-600 dark:text-blue-400',  icon: 'bi-check-circle' },
          { label: 'Inspectées',  value: stats?.inspected ?? 0,         color: 'text-green-600 dark:text-green-400', icon: 'bi-patch-check' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <i className={`bi ${s.icon} text-2xl ${s.color}`} />
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="card mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
          <i className="bi bi-search text-gray-400 dark:text-gray-500" />
          <input
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
            placeholder="Chambre, notes…"
            className="flex-1 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-transparent focus:outline-none"
          />
        </div>
        <select
          value={filter.status}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          className="text-sm text-gray-700 dark:text-gray-200 bg-transparent"
        >
          <option value="">Tous les statuts</option>
          <option value="pending">À nettoyer</option>
          <option value="in_progress">En cours</option>
          <option value="done">Terminé</option>
          <option value="inspected">Inspecté</option>
        </select>
      </div>

      {/* Liste des tâches */}
      {loading ? (
        <SkeletonRoomsGrid count={8} />
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <i className="bi bi-check2-all text-5xl text-green-300 dark:text-green-700" />
          <p className="mt-3 font-medium text-gray-500 dark:text-gray-400">Aucune tâche en cours</p>
          <p className="text-sm">Toutes les chambres sont propres !</p>
        </div>
      ) : (
        <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map(task => {
            const sc = STATUS_CONFIG[task.status]
            return (
              <div key={task.id} className="card hover:shadow-md transition-shadow">
                {/* En-tête */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Chambre {task.room_number}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{task.room_type} · Étage {task.floor}</p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className={`badge text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.color}`}>
                      <i className={`bi ${sc.icon} mr-1`} />{sc.label}
                    </span>
                    {task.priority === 'urgent' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                        🔴 URGENT
                      </span>
                    )}
                  </div>
                </div>

                {/* Infos */}
                {task.booking_ref && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <i className="bi bi-bookmark-check mr-1" /> Réf. {task.booking_ref}
                  </p>
                )}
                {task.assigned_to_name && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <i className="bi bi-person mr-1" /> {task.assigned_to_name}
                  </p>
                )}
                {task.scheduled_for && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <i className="bi bi-calendar mr-1" /> Prévue le {formatDate(task.scheduled_for)}
                  </p>
                )}
                {task.notes && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1 mb-2 line-clamp-2">{task.notes}</p>
                )}

                {/* Timings */}
                {task.started_at && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    <i className="bi bi-clock mr-1" /> Début : {new Date(task.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {task.completed_at && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    <i className="bi bi-check mr-1" /> Fin : {new Date(task.completed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  {task.status === 'pending' && (
                    <button
                      onClick={() => handleAction('start', task.id)}
                      className="flex-1 btn-primary text-xs py-1.5 justify-center"
                    >
                      <i className="bi bi-play-fill" /> Démarrer
                    </button>
                  )}
                  {task.status === 'in_progress' && (
                    <button
                      onClick={() => handleAction('complete', task.id)}
                      className="flex-1 btn-primary text-xs py-1.5 justify-center"
                    >
                      <i className="bi bi-check-lg" /> Terminer
                    </button>
                  )}
                  {task.status === 'done' && (
                    <button
                      onClick={() => handleAction('inspect', task.id)}
                      className="flex-1 text-xs py-1.5 justify-center bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-700 text-white rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <i className="bi bi-patch-check" /> Inspecter
                    </button>
                  )}
                  {task.status === 'inspected' && (
                    <div className="flex-1 text-center text-xs text-green-600 dark:text-green-400 font-medium py-1.5">
                      <i className="bi bi-check-all" /> Terminé &amp; inspecté
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <Pagination page={page} total={total} onChange={setPage} />
        </div>
      )}
    </div>
  )
}
