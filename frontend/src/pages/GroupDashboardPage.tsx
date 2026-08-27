import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { tenantsApi, Hotel, PLAN_LABELS } from '../api/tenants'
import { formatFcfa, getApiError } from '../utils'
import PageHeader from '../components/PageHeader'
import FormField from '../components/FormField'
import { SkeletonTablePage } from '../components/Skeleton'

const PLAN_COLORS: Record<string, string> = {
  basic: 'bg-gray-100 text-gray-600',
  pro: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-amber-100 text-amber-700',
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
        <p className="text-sm text-gray-700 font-medium">Vue d'ensemble de tous les hôtels clients de la plateforme</p>
      </PageHeader>

      {/* Totaux */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          ['Hôtels', totals.hotels, 'bi-building', 'text-blue-600', 'bg-blue-100'],
          ['Utilisateurs', totals.users, 'bi-people', 'text-purple-600', 'bg-purple-100'],
          ['Chambres', totals.rooms, 'bi-door-open', 'text-amber-600', 'bg-amber-100'],
          ['Réservations', totals.bookings, 'bi-bookmark-check', 'text-green-600', 'bg-green-100'],
        ].map(([label, value, icon, color, bg]) => (
          <div key={label as string} className="card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
              <i className={`bi ${icon} ${color}`} />
            </div>
            <div><p className="text-xs text-gray-400">{label}</p><p className="text-lg font-bold text-gray-900">{value}</p></div>
          </div>
        ))}
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0"><i className="bi bi-cash-stack text-emerald-600" /></div>
          <div><p className="text-xs text-gray-400">Revenu cumulé</p><p className="text-lg font-bold text-gray-900">{formatFcfa(totals.revenue)}</p></div>
        </div>
      </div>

      {loading ? (
        <SkeletonTablePage cardCount={0} rows={6} cols={5} withToolbar={false} />
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Hôtel</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Statut</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Fin d'essai</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Utilisateurs</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Chambres</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Réservations</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Revenu</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {hotels.map(h => (
                <tr key={h.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{h.name}</p>
                    <p className="text-xs text-gray-400">{h.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_COLORS[h.plan] ?? PLAN_COLORS.basic}`}>
                      {PLAN_LABELS[h.plan] ?? h.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${h.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      <i className={`bi ${h.is_active ? 'bi-check-circle-fill' : 'bi-x-circle'} text-[10px]`} />
                      {h.is_active ? 'Actif' : 'Suspendu'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(h.trial_ends_at)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{h.users_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{h.rooms_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{h.bookings_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatFcfa(h.revenue_total)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(h)} className="text-gray-400 hover:text-hotel-gold transition-colors">
                      <i className="bi bi-gear" />
                    </button>
                  </td>
                </tr>
              ))}
              {hotels.length === 0 && (
                <tr><td colSpan={9} className="text-center py-16 text-gray-400">Aucun hôtel enregistré</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Gérer l'abonnement</h3>
            <p className="text-sm text-gray-400 mb-5">{editing.name}</p>
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
                  <span className="text-sm font-medium text-gray-700">Compte actif</span>
                </label>
                {!form.is_active && (
                  <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1.5">
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
