import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { tenantsApi, Hotel, PLAN_LABELS } from '../api/tenants'
import { formatFcfa, getApiError } from '../utils'
import PageHeader from '../components/PageHeader'
import FormField from '../components/FormField'
import { SkeletonTablePage } from '../components/Skeleton'

const PLAN_COLORS: Record<string, string> = {
  basic: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  pro: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  enterprise: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function GroupDashboardPage() {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Hotel | null>(null)
  const [form, setForm] = useState({ plan: 'basic', is_active: true, trial_ends_at: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    tenantsApi.listHotels()
      .then(setHotels)
      .catch(err => toast.error(getApiError(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (h: Hotel) => {
    setEditing(h)
    setForm({ plan: h.plan, is_active: h.is_active, trial_ends_at: h.trial_ends_at ? h.trial_ends_at.slice(0, 10) : '' })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      await tenantsApi.updateHotel(editing.id, {
        plan: form.plan as Hotel['plan'],
        is_active: form.is_active,
        trial_ends_at: form.trial_ends_at || null,
      })
      toast.success('Abonnement mis à jour')
      setEditing(null)
      load()
    } catch (err) {
      toast.error(getApiError(err))
    } finally { setSaving(false) }
  }

  const totals = hotels.reduce((acc, h) => ({
    hotels: acc.hotels + 1,
    users: acc.users + h.users_count,
    rooms: acc.rooms + h.rooms_count,
    bookings: acc.bookings + h.bookings_count,
    revenue: acc.revenue + h.revenue_total,
  }), { hotels: 0, users: 0, rooms: 0, bookings: 0, revenue: 0 })

  return (
    <div className="p-4">
      <PageHeader>
        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Vue d'ensemble de tous les hôtels clients de la plateforme</p>
      </PageHeader>

      {/* Totaux */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          ['Hôtels', totals.hotels, 'bi-building', 'text-blue-600 dark:text-blue-400', 'bg-blue-100 dark:bg-blue-900/40'],
          ['Utilisateurs', totals.users, 'bi-people', 'text-purple-600 dark:text-purple-400', 'bg-purple-100 dark:bg-purple-900/40'],
          ['Chambres', totals.rooms, 'bi-door-open', 'text-amber-600 dark:text-amber-400', 'bg-amber-100 dark:bg-amber-900/40'],
          ['Réservations', totals.bookings, 'bi-bookmark-check', 'text-green-600 dark:text-green-400', 'bg-green-100 dark:bg-green-900/40'],
        ].map(([label, value, icon, color, bg]) => (
          <div key={label as string} className="card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
              <i className={`bi ${icon} ${color}`} />
            </div>
            <div><p className="text-xs text-gray-400 dark:text-gray-500">{label}</p><p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p></div>
          </div>
        ))}
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0"><i className="bi bi-cash-stack text-emerald-600 dark:text-emerald-400" /></div>
          <div><p className="text-xs text-gray-400 dark:text-gray-500">Revenu cumulé</p><p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatFcfa(totals.revenue)}</p></div>
        </div>
      </div>

      {loading ? (
        <SkeletonTablePage cardCount={0} rows={6} cols={5} withToolbar={false} />
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Hôtel</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Statut</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Fin d'essai</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Utilisateurs</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Chambres</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Réservations</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Revenu</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {hotels.map(h => (
                <tr key={h.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{h.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{h.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_COLORS[h.plan] ?? PLAN_COLORS.basic}`}>
                      {PLAN_LABELS[h.plan] ?? h.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${h.is_active ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                      <i className={`bi ${h.is_active ? 'bi-check-circle-fill' : 'bi-x-circle'} text-[10px]`} />
                      {h.is_active ? 'Actif' : 'Suspendu'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{fmtDate(h.trial_ends_at)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{h.users_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{h.rooms_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{h.bookings_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{formatFcfa(h.revenue_total)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(h)} className="text-gray-400 dark:text-gray-500 hover:text-hotel-gold transition-colors">
                      <i className="bi bi-gear" />
                    </button>
                  </td>
                </tr>
              ))}
              {hotels.length === 0 && (
                <tr><td colSpan={9} className="text-center py-16 text-gray-400 dark:text-gray-500">Aucun hôtel enregistré</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Gérer l'abonnement</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">{editing.name}</p>
            <form onSubmit={handleSave} className="space-y-4">
              <FormField label="Plan tarifaire" icon="bi-tags">
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                  <option value="basic">Basic (1 hôtel)</option>
                  <option value="pro">Pro (analytics avancés)</option>
                  <option value="enterprise">Enterprise (multi-propriétés)</option>
                </select>
              </FormField>
              <FormField label="Fin de la période d'essai" icon="bi-calendar3">
                <input type="date" value={form.trial_ends_at} onChange={e => setForm(f => ({ ...f, trial_ends_at: e.target.value }))} />
              </FormField>
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="w-4 h-4 accent-hotel-gold" checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Compte actif</span>
                </label>
                {!form.is_active && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1.5">
                    <i className="bi bi-info-circle" /> Un hôtel suspendu ne pourra plus se connecter.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
