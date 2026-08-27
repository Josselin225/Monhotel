import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { bookingsApi } from '../api/bookings'
import { trackingApi, VisitStats } from '../api/tracking'
import { getApiError, formatFcfa } from '../utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import PageHeader from '../components/PageHeader'
import { SkeletonAnalytics } from '../components/Skeleton'

interface Analytics {
  current:  Metrics
  previous: Metrics
  monthly:  (Metrics & { month: string; year: number; label: string })[]
  sources:  { source: string; label: string; count: number }[]
  total_rooms: number
}

interface Metrics {
  revenue: number
  nights_sold: number
  adr: number
  occupancy: number
  revpar: number
  bookings: number
}

const SOURCE_COLORS = ['#A8762A', '#3B82F6', '#10B981', '#8B5CF6']

function delta(curr: number, prev: number) {
  if (!prev) return null
  const pct = ((curr - prev) / prev) * 100
  return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 }
}

function KpiCard({ label, value, prev, format = (v: number) => String(Math.round(v)), suffix = '' }: {
  label: string; value: number; prev: number
  format?: (v: number) => string; suffix?: string
}) {
  const d = delta(value, prev)
  return (
    <div className="card">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{format(value)}{suffix}</p>
      {d && (
        <p className={`text-xs mt-1 font-medium flex items-center gap-1 ${d.up ? 'text-green-600' : 'text-red-500'}`}>
          <i className={`bi bi-arrow-${d.up ? 'up' : 'down'}`} />
          {d.pct}% vs mois précédent
        </p>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData]   = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [visits, setVisits]   = useState<VisitStats | null>(null)

  useEffect(() => {
    setLoading(true)
    bookingsApi.analytics({ year: String(year), month: String(month) })
      .then(setData)
      .catch(err => toast.error(getApiError(err)))
      .finally(() => setLoading(false))
  }, [year, month])

  useEffect(() => {
    trackingApi.getStats().then(setVisits).catch(() => {})
  }, [])

  const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  return (
    <div className="p-4">
      <PageHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700 font-medium">Taux d'occupation, revenus, ADR &amp; RevPAR</p>
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
            >
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
            >
              {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </PageHeader>

      {loading ? (
        <SkeletonAnalytics />
      ) : data ? (
        <div className="space-y-4">

          {/* ── Visites du site public ── */}
          {visits && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wider">
                <i className="bi bi-globe me-2 text-hotel-gold" />Visites du site public
              </h3>

              {/* KPI visites */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: '30 derniers jours',        v: visits.last_30_days.visits,  icon: 'eye',          color: 'text-hotel-gold' },
                  { label: 'Visiteurs uniques (30j)',   v: visits.last_30_days.unique,  icon: 'person',       color: 'text-blue-600'   },
                  { label: '3 derniers mois',           v: visits.last_90_days.visits,  icon: 'bar-chart',    color: 'text-hotel-gold' },
                  { label: 'Visiteurs uniques (90j)',   v: visits.last_90_days.unique,  icon: 'people',       color: 'text-blue-600'   },
                ].map(({ label, v, icon, color }) => (
                  <div key={label} className="card">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <i className={`bi bi-${icon} ${color}`} />{label}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">{v}</p>
                  </div>
                ))}
              </div>

              {/* Graphique visites quotidiennes */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Visites par jour — 3 derniers mois</h3>
                {visits.daily.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                    <i className="bi bi-bar-chart me-2" />Aucune visite enregistrée
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={visits.daily} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={d => {
                          const dt = new Date(d)
                          return `${dt.getDate()}/${dt.getMonth() + 1}`
                        }}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        axisLine={false} tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                      <Tooltip
                        labelFormatter={d => new Date(d).toLocaleDateString('fr-FR')}
                        formatter={(v: number, name: string) => [v, name === 'visits' ? 'Visites' : 'Uniques']}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e0d8' }}
                      />
                      <Line type="monotone" dataKey="visits" stroke="#A8762A" strokeWidth={2} dot={false} name="visits" />
                      <Line type="monotone" dataKey="unique" stroke="#6B7280" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="unique" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <div className="flex items-center gap-4 mt-3 justify-center">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="inline-block w-5 h-0.5 bg-hotel-gold rounded" />Visites totales
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="inline-block w-5 h-0.5 bg-gray-400 rounded border-dashed" />Visiteurs uniques
                  </span>
                </div>
              </div>

              {/* Provenance */}
              {visits.referrers.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-gray-900 mb-4">Sources de trafic (3 mois)</h3>
                  <div className="space-y-2">
                    {visits.referrers.map(r => {
                      const total = visits.referrers.reduce((s, x) => s + x.count, 0)
                      const pct   = Math.round((r.count / total) * 100)
                      const label = r.referrer.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
                      return (
                        <div key={r.referrer}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-gray-600 truncate max-w-xs">{label}</span>
                            <span className="font-semibold text-gray-900 ml-2">{r.count} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100">
                            <div className="h-1.5 rounded-full bg-hotel-gold transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Séparateur ── */}
          {visits && <hr className="border-gray-100" />}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              label="Revenus"
              value={data.current.revenue}
              prev={data.previous.revenue}
              format={v => formatFcfa(v)}
            />
            <KpiCard
              label="Taux d'occupation"
              value={data.current.occupancy}
              prev={data.previous.occupancy}
              format={v => v.toFixed(1)}
              suffix="%"
            />
            <KpiCard
              label="ADR (prix moyen/nuit)"
              value={data.current.adr}
              prev={data.previous.adr}
              format={v => formatFcfa(v)}
            />
            <KpiCard
              label="RevPAR"
              value={data.current.revpar}
              prev={data.previous.revpar}
              format={v => formatFcfa(v)}
            />
            <KpiCard
              label="Réservations"
              value={data.current.bookings}
              prev={data.previous.bookings}
            />
          </div>

          {/* Graphique revenus 12 mois */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Revenus — 12 derniers mois</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.monthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => v === 0 ? '0' : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={72} />
                <Tooltip
                  formatter={(v: number) => [formatFcfa(v), 'Revenus']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e0d8' }}
                />
                <Bar dataKey="revenue" fill="#A8762A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Taux d'occupation 12 mois */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Taux d'occupation — 12 derniers mois</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.monthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} domain={[0, 100]} width={40} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "Taux d'occupation"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="occupancy" stroke="#A8762A" strokeWidth={2} dot={{ r: 3, fill: '#A8762A' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Répartition sources + nuits vendues */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Sources de réservation</h3>
              {data.sources.some(s => s.count > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.sources.filter(s => s.count > 0)}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.sources.filter(s => s.count > 0).map((_, i) => (
                        <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                  Aucune réservation ce mois-ci
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Résumé du mois</h3>
              <div className="space-y-3">
                {[
                  { label: 'Chambres disponibles', value: String(data.total_rooms) },
                  { label: 'Nuits vendues', value: String(data.current.nights_sold) },
                  { label: 'Revenus totaux', value: formatFcfa(data.current.revenue) },
                  { label: 'ADR moyen', value: formatFcfa(data.current.adr) },
                  { label: 'RevPAR', value: formatFcfa(data.current.revpar) },
                  { label: "Taux d'occupation", value: `${data.current.occupancy.toFixed(1)}%` },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-500">{row.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
