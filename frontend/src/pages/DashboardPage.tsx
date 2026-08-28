import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import { SkeletonDashboard } from '../components/Skeleton'
import { bookingsApi } from '../api/bookings'
import { billingApi } from '../api/billing'
import { roomsApi } from '../api/rooms'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import { formatFcfaShort, getCurrencyLabel, getApiError } from '../utils'
import { useAppSettings } from '../hooks/useAppSettings'

function KpiCard({ title, value, sub, icon, color = 'gold', trend, onClick }: {
  title: string; value: string | number; sub?: string; icon: string
  color?: 'gold' | 'blue' | 'green' | 'orange' | 'purple' | 'red'
  trend?: { value: number; label: string }
  onClick?: () => void
}) {
  const colorMap = {
    gold:   { bg: 'bg-amber-50 dark:bg-amber-950/40',   text: 'text-amber-600 dark:text-amber-400'  },
    blue:   { bg: 'bg-blue-50 dark:bg-blue-950/40',    text: 'text-blue-600 dark:text-blue-400'   },
    green:  { bg: 'bg-green-50 dark:bg-green-950/40',   text: 'text-green-600 dark:text-green-400'  },
    orange: { bg: 'bg-orange-50 dark:bg-orange-950/40',  text: 'text-orange-600 dark:text-orange-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950/40',  text: 'text-purple-600 dark:text-purple-400' },
    red:    { bg: 'bg-red-50 dark:bg-red-950/40',     text: 'text-red-500 dark:text-red-400'    },
  }
  const c = colorMap[color]
  return (
    <div
      onClick={onClick}
      className={`card flex gap-4 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
        <i className={`bi ${icon} text-xl ${c.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
        {trend && (
          <p className={`text-xs font-medium mt-1 ${trend.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
            <i className={`bi bi-arrow-${trend.value >= 0 ? 'up' : 'down'} text-[10px]`} /> {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </div>
    </div>
  )
}

const ROOM_COLORS = {
  available: '#22c55e', occupied: '#ef4444', maintenance: '#f59e0b', cleaning: '#3b82f6',
}
const ROOM_LABELS: Record<string, string> = {
  available: 'Disponible', occupied: 'Occupée', maintenance: 'Maintenance', cleaning: 'Nettoyage',
}

export default function DashboardPage() {
  const { user } = useAuth()
  useAppSettings()
  const queryClient = useQueryClient()
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [quickModal, setQuickModal]       = useState<'arrivals' | 'departures' | null>(null)

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const { data, isLoading: loading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [bs, is, mr, rooms, notifs, analy] = await Promise.all([
        bookingsApi.stats(),
        billingApi.stats(),
        billingApi.monthlyRevenue(),
        roomsApi.list({ page_size: '200' }),
        bookingsApi.notifications(),
        bookingsApi.analytics(),
      ])
      const counts: Record<string, number> = {}
      for (const r of rooms.results) counts[r.status] = (counts[r.status] || 0) + 1
      const roomStatusData = Object.entries(counts).map(([k, v]) => ({
        name: ROOM_LABELS[k] || k, value: v,
        color: ROOM_COLORS[k as keyof typeof ROOM_COLORS] || '#6b7280',
      }))
      return { bStats: bs, iStats: is, monthlyRevenue: mr, roomStatusData, analytics: analy, notifications: notifs }
    },
  })

  const bStats        = data?.bStats        ?? null
  const iStats        = data?.iStats        ?? null
  const monthlyRevenue = data?.monthlyRevenue ?? []
  const roomStatusData = data?.roomStatusData ?? []
  const analytics     = data?.analytics     ?? null
  const notifications = data?.notifications ?? null

  const handleCheckIn = async (id: number) => {
    setActionLoading(id)
    try {
      await bookingsApi.checkIn(id)
      toast.success('Check-in effectué')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (err) { toast.error(getApiError(err)) }
    finally { setActionLoading(null) }
  }

  const handleCheckOut = async (id: number) => {
    setActionLoading(id)
    try {
      await bookingsApi.checkOut(id)
      toast.success('Check-out effectué — chambre en nettoyage')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (err) { toast.error(getApiError(err)) }
    finally { setActionLoading(null) }
  }

  const occ   = analytics?.current?.occupancy ?? null
  const revpar = analytics?.current?.revpar ?? null
  const adr    = analytics?.current?.adr ?? null

  const occTrend = analytics?.current && analytics?.previous && analytics.previous.occupancy > 0
    ? Math.round(((analytics.current.occupancy - analytics.previous.occupancy) / analytics.previous.occupancy) * 100)
    : null

  if (loading) return <SkeletonDashboard />

  // Prévisions 7 jours : occupancy mensuelle glissante
  const forecast = (analytics?.monthly ?? []).slice(-7)

  return (
    <div className="p-4 space-y-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 capitalize font-medium">{today}</p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
              Bonjour, {user?.first_name || user?.username}
            </h2>
          </div>
          <a href="/app/bookings" className="btn-primary text-sm self-start sm:self-auto">
            + Réservation
          </a>
        </div>
      </PageHeader>

      {/* KPIs principaux */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Arrivées aujourd'hui" value={bStats?.arrivals_today ?? '—'}   icon="bi-airplane-engines" color="blue"   sub="Check-ins à effectuer"  onClick={() => setQuickModal('arrivals')} />
        <KpiCard title="Départs aujourd'hui"  value={bStats?.departures_today ?? '—'} icon="bi-luggage"           color="orange" sub="Check-outs à effectuer" onClick={() => setQuickModal('departures')} />
        <KpiCard title="Taux d'occupation"
          value={occ !== null ? `${occ}%` : '—'}
          icon="bi-bar-chart-fill" color="green"
          sub="Mois en cours"
          trend={occTrend !== null ? { value: occTrend, label: 'vs mois préc.' } : undefined}
        />
        <KpiCard title="Revenus du mois"
          value={iStats ? formatFcfaShort(Number(iStats.month_revenue)) : '—'}
          icon="bi-cash-coin" color="gold" sub="Factures encaissées"
        />
      </div>

      {/* KPIs analytiques */}
      <div className="grid sm:grid-cols-3 gap-4">
        <KpiCard title="RevPAR"         value={revpar !== null ? formatFcfaShort(revpar) : '—'} icon="bi-graph-up-arrow"  color="purple" sub="Revenu par chambre disponible" />
        <KpiCard title="ADR"            value={adr    !== null ? formatFcfaShort(adr)    : '—'} icon="bi-currency-exchange" color="blue"  sub="Prix moyen par nuit vendue" />
        <KpiCard title="Chambres occupées" value={bStats?.checked_in ?? '—'}                    icon="bi-door-closed"       color="red"   sub="En cours de séjour" />
      </div>

      {/* Arrivées & Départs du jour */}
      {((notifications?.arrivals.length ?? 0) > 0 || (notifications?.departures.length ?? 0) > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Arrivées */}
          {(notifications?.arrivals.length ?? 0) > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <i className="bi bi-airplane-engines text-blue-500 dark:text-blue-400" />
                Check-ins à effectuer
                <span className="ml-auto text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">
                  {notifications!.arrivals.length}
                </span>
              </h3>
              <div className="space-y-2">
                {notifications!.arrivals.map(b => (
                  <div key={b.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm shrink-0">
                      {b.room}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{b.client}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{b.reference}</p>
                    </div>
                    <button
                      onClick={() => handleCheckIn(b.id)}
                      disabled={actionLoading === b.id}
                      className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 shrink-0"
                    >
                      {actionLoading === b.id ? <i className="bi bi-arrow-repeat animate-spin" /> : 'Check-in'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Départs */}
          {(notifications?.departures.length ?? 0) > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <i className="bi bi-luggage text-orange-500 dark:text-orange-400" />
                Check-outs à effectuer
                <span className="ml-auto text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full font-bold">
                  {notifications!.departures.length}
                </span>
              </h3>
              <div className="space-y-2">
                {notifications!.departures.map(b => (
                  <div key={b.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-sm shrink-0">
                      {b.room}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{b.client}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{b.reference}</p>
                    </div>
                    <button
                      onClick={() => handleCheckOut(b.id)}
                      disabled={actionLoading === b.id}
                      className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 shrink-0"
                    >
                      {actionLoading === b.id ? <i className="bi bi-arrow-repeat animate-spin" /> : 'Check-out'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Graphiques */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Revenus + taux d'occupation 12 mois */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Revenus & occupation — 12 mois ({getCurrencyLabel()})</h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">Chargement…</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyRevenue.map(m => ({ ...m, revenue: Number(m.revenue) }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tickFormatter={v => formatFcfaShort(v)} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  formatter={(v: number) => [new Intl.NumberFormat('fr-FR').format(v) + ' ' + getCurrencyLabel(), 'Revenu']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="#c9973a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Statut chambres */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">État des chambres</h3>
          {loading || roomStatusData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">Chargement…</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={roomStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {roomStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {roomStatusData.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                      <span className="text-gray-600 dark:text-gray-300">{s.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Évolution taux d'occupation (7 derniers mois) */}
      {!loading && (analytics?.monthly ?? []).length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Évolution taux d'occupation — 7 derniers mois</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={(analytics.monthly as any[]).slice(-7)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(1)}%`, "Taux d'occupation"]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              />
              <Line type="monotone" dataKey="occupancy" stroke="#c9973a" strokeWidth={2} dot={{ fill: '#c9973a', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* KPIs secondaires */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="En attente"             value={bStats?.pending ?? '—'}  icon="bi-hourglass-split"    color="orange" sub="Réservations à confirmer" />
        <KpiCard title="Confirmées"             value={bStats?.confirmed ?? '—'} icon="bi-check-circle"       color="green"  sub="Prêtes pour check-in" />
        <KpiCard title="En attente de paiement" value={iStats ? formatFcfaShort(Number(iStats.pending_amount)) : '—'} icon="bi-file-earmark-text" color="purple" sub="Factures émises" />
        <KpiCard title="Total encaissé"         value={iStats ? formatFcfaShort(Number(iStats.total_revenue)) : '—'}  icon="bi-bank"              color="blue"   sub="Depuis l'ouverture" />
      </div>

      {/* Actions rapides */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Actions rapides</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { href: '/app/bookings', label: 'Nouvelle réservation', icon: 'bi-plus-circle',  color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/40'  },
            { href: '/app/clients',  label: 'Nouveau client',       icon: 'bi-person-plus',  color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-950/40'   },
            { href: '/app/rooms',    label: 'Gérer les chambres',   icon: 'bi-door-open',    color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-950/40'  },
            { href: '/app/planning', label: 'Planning',             icon: 'bi-calendar3',    color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40' },
            { href: '/app/billing',  label: 'Facturation',          icon: 'bi-receipt',      color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40' },
          ].map(a => (
            <a key={a.href} href={a.href}
              className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm transition-all duration-200 text-center group bg-white dark:bg-gray-800"
            >
              <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <i className={`bi ${a.icon} text-xl ${a.color}`} />
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 leading-tight">{a.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* ── Modal check-in / check-out rapide ── */}
      {quickModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setQuickModal(null)}>
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${quickModal === 'arrivals' ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-orange-100 dark:bg-orange-900/40'}`}>
                  <i className={`bi ${quickModal === 'arrivals' ? 'bi-airplane-engines text-blue-600 dark:text-blue-400' : 'bi-luggage text-orange-600 dark:text-orange-400'} text-lg`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {quickModal === 'arrivals' ? 'Arrivées du jour' : 'Départs du jour'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {quickModal === 'arrivals'
                      ? `${notifications?.arrivals.length ?? 0} check-in(s) à effectuer`
                      : `${notifications?.departures.length ?? 0} check-out(s) à effectuer`}
                  </p>
                </div>
              </div>
              <button onClick={() => setQuickModal(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {(quickModal === 'arrivals' ? notifications?.arrivals : notifications?.departures)?.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Aucune action en attente.</p>
              )}
              {(quickModal === 'arrivals' ? notifications?.arrivals : notifications?.departures)?.map(b => (
                <div key={b.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${quickModal === 'arrivals' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'}`}>
                    {b.room}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{b.client}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{b.reference}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (quickModal === 'arrivals') await handleCheckIn(b.id)
                      else await handleCheckOut(b.id)
                    }}
                    disabled={actionLoading === b.id}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 shrink-0 transition-colors ${
                      quickModal === 'arrivals'
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}
                  >
                    {actionLoading === b.id
                      ? <i className="bi bi-arrow-repeat animate-spin" />
                      : quickModal === 'arrivals' ? 'Check-in' : 'Check-out'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
