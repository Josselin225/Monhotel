import { useEffect, useState } from 'react'
import { reportsApi, MonthlyReport } from '../api/reports'
import { getContent } from '../api/content'
import { generateMonthlyReportPdf } from '../utils/pdfReport'

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

function fmt(n: number, dec = 0): string {
  const abs   = Math.abs(n)
  const fixed = abs.toFixed(dec)
  const parts = fixed.split('.')
  parts[0]    = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const body  = dec > 0 ? parts[0] + ',' + (parts[1] ?? '0') : parts[0]
  return n < 0 ? '- ' + body : body
}
const fmtM   = (n: number) => fmt(n) + ' FCFA'
const fmtPct = (n: number) => fmt(n, 1) + ' %'

/* ── Composants ────────────────────────────────────────────────────────── */

function KpiCard({ label, value, sub, stripe, bg, iconBg, icon }: {
  label: string; value: string; sub?: string
  stripe: string; bg: string; iconBg: string; icon: string
}) {
  return (
    <div className={`rounded-xl border border-gray-100 shadow-sm overflow-hidden ${bg}`}>
      <div className={`h-1 ${stripe}`} />
      <div className="p-4">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>
          <i className={`bi ${icon} text-base`} style={{ color: 'inherit' }} />
        </div>
        <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function Section({ title, icon, children, className = '' }: {
  title: string; icon: string; children: React.ReactNode; className?: string
}) {
  return (
    <section className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
          <i className={`bi ${icon} text-amber-600 text-sm`} />
        </div>
        <h2 className="font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function StatRow({ label, value, highlight = false, valueClass = '' }: {
  label: string; value: string; highlight?: boolean; valueClass?: string
}) {
  return (
    <div className={`flex justify-between items-center py-2 border-b border-gray-50 last:border-0 ${highlight ? 'font-semibold' : ''}`}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${valueClass || (highlight ? 'text-gray-900' : 'text-gray-700')}`}>{value}</span>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  const pct   = (value / 5) * 100
  const color = value >= 4 ? '#16a34a' : value >= 3 ? '#d97706' : '#dc2626'
  const bg    = value >= 4 ? '#f0fdf4' : value >= 3 ? '#fffbeb' : '#fef2f2'
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-sm text-gray-600 w-36 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-bold w-8 text-right rounded px-1" style={{ color, backgroundColor: bg }}>
        {value.toFixed(1)}
      </span>
    </div>
  )
}

function CircleGauge({ value, max = 5, color }: { value: number; max?: number; color: string }) {
  const r         = 42
  const circ      = 2 * Math.PI * r
  const pct       = Math.min(value / max, 1)
  const dashArray = `${circ * pct} ${circ * (1 - pct)}`
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={dashArray} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  )
}

function FinanceBar({ income, expense }: { income: number; expense: number }) {
  const total    = income + expense
  const incPct   = total > 0 ? (income / total) * 100 : 50
  const expPct   = 100 - incPct
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Revenus</span>
        <span>Dépenses</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden">
        <div className="bg-emerald-400 transition-all duration-500" style={{ width: `${incPct}%` }} />
        <div className="bg-red-400 transition-all duration-500" style={{ width: `${expPct}%` }} />
      </div>
      <div className="flex justify-between text-xs mt-1">
        <span className="text-emerald-600 font-medium">{incPct.toFixed(0)}%</span>
        <span className="text-red-600 font-medium">{expPct.toFixed(0)}%</span>
      </div>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function MonthlyReportPage() {
  const today  = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [report,    setReport]    = useState<MonthlyReport | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [hotelName, setHotelName] = useState('Mon Hôtel')

  useEffect(() => {
    getContent().then(c => setHotelName(c.hotel.name || 'Mon Hôtel')).catch(() => {})
  }, [])

  const load = async (y: number, m: number) => {
    setLoading(true)
    setError('')
    try { setReport(await reportsApi.monthly(y, m)) }
    catch { setError('Impossible de charger le rapport.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load(year, month) }, [])

  const changeMonth = (m: number) => { setMonth(m); load(year, m) }
  const changeYear  = (y: number) => { setYear(y);  load(y, month) }

  const yearOptions = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i)

  const r = report

  return (
    <div className="p-4 space-y-5">

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Rapport mensuel de gestion</h1>
          <p className="text-sm text-gray-400 mt-0.5">Synthèse des indicateurs clés par période</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
            value={month} onChange={e => changeMonth(Number(e.target.value))}
          >
            {MONTHS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
            value={year} onChange={e => changeYear(Number(e.target.value))}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => load(year, month)} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-hotel-gold text-white hover:bg-amber-600 disabled:opacity-60 transition-colors shadow-sm">
            <i className={`bi ${loading ? 'bi-arrow-clockwise animate-spin' : 'bi-arrow-clockwise'}`} />
            {loading ? 'Chargement…' : 'Actualiser'}
          </button>
          {r && (
            <button onClick={() => generateMonthlyReportPdf(r, hotelName)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
              <i className="bi bi-file-earmark-arrow-down text-amber-500" />
              Exporter PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Erreur ── */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <i className="bi bi-exclamation-triangle-fill" /> {error}
        </div>
      )}

      {/* ── Chargement ── */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
            <p className="text-sm text-gray-400">Génération du rapport…</p>
          </div>
        </div>
      )}

      {r && !loading && (
        <>
          {/* ── Bandeau période ── */}
          <div className="flex items-center gap-4 px-5 py-3.5 bg-hotel-dark rounded-xl text-white">
            <div className="w-9 h-9 rounded-lg bg-hotel-gold/20 flex items-center justify-center shrink-0">
              <i className="bi bi-calendar-month text-hotel-gold" />
            </div>
            <div>
              <p className="text-xs text-amber-300 uppercase tracking-widest font-semibold">Période analysée</p>
              <p className="font-bold text-lg leading-tight">{r.period.label}</p>
            </div>
            <div className="ml-auto hidden sm:flex items-center gap-4 text-sm">
              <div className="text-center">
                <p className="text-amber-300 text-xs uppercase tracking-wide">Revenus</p>
                <p className="font-bold text-emerald-400">{fmtM(r.bookings.revenue)}</p>
              </div>
              <div className="text-center">
                <p className="text-amber-300 text-xs uppercase tracking-wide">Occupation</p>
                <p className="font-bold">{fmtPct(r.bookings.occupancy)}</p>
              </div>
              <div className="text-center">
                <p className="text-amber-300 text-xs uppercase tracking-wide">Réservations</p>
                <p className="font-bold">{r.bookings.total}</p>
              </div>
            </div>
          </div>

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
              label="Revenus hébergement" value={fmtM(r.bookings.revenue)}
              stripe="bg-emerald-400" bg="bg-emerald-50/40" iconBg="bg-emerald-100"
              icon="bi-graph-up-arrow text-emerald-600"
            />
            <KpiCard
              label="Taux d'occupation" value={fmtPct(r.bookings.occupancy)}
              sub={`${r.bookings.nights_sold} nuits vendues`}
              stripe="bg-blue-400" bg="bg-blue-50/40" iconBg="bg-blue-100"
              icon="bi-house-check text-blue-600"
            />
            <KpiCard
              label="RevPAR" value={fmt(r.bookings.revpar) + ' FCFA'}
              sub="Revenu / chambre dispo"
              stripe="bg-violet-400" bg="bg-violet-50/40" iconBg="bg-violet-100"
              icon="bi-bar-chart-fill text-violet-600"
            />
            <KpiCard
              label="ADR · Prix moyen / nuit" value={fmt(r.bookings.adr) + ' FCFA'}
              sub={`${r.bookings.total_rooms} chambres`}
              stripe="bg-amber-400" bg="bg-amber-50/40" iconBg="bg-amber-100"
              icon="bi-tag-fill text-amber-600"
            />
            <KpiCard
              label="Réservations" value={String(r.bookings.total)}
              sub={`${r.bookings.cancelled} annulées · ${r.bookings.no_show} no-shows`}
              stripe="bg-primary-400" bg="bg-orange-50/40" iconBg="bg-orange-100"
              icon="bi-bookmark-check-fill text-orange-600"
            />
          </div>

          {/* ── Réservations + Finances ── */}
          <div className="grid lg:grid-cols-2 gap-5">

            <Section title="Réservations" icon="bi-bookmark-check">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Statuts</p>
                  <StatRow label="Total du mois"       value={String(r.bookings.total)} highlight />
                  <StatRow label="Confirmées"           value={String(r.bookings.confirmed)} />
                  <StatRow label="En cours (check-in)"  value={String(r.bookings.checked_in)} />
                  <StatRow label="Terminées"            value={String(r.bookings.checked_out)} />
                  <StatRow label="Annulées"             value={String(r.bookings.cancelled)} valueClass="text-red-600" />
                  <StatRow label="No-shows"             value={String(r.bookings.no_show)} valueClass="text-orange-600" />
                  <StatRow label="Nuits vendues"        value={String(r.bookings.nights_sold)} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Sources</p>
                  {r.bookings.sources.map(s => {
                    const pct = r.bookings.total > 0 ? (s.count / r.bookings.total) * 100 : 0
                    return (
                      <div key={s.source} className="py-2 border-b border-gray-50 last:border-0">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{s.label}</span>
                          <span className="font-semibold text-gray-800">{s.count}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-hotel-gold rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{pct.toFixed(0)}%</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Section>

            <Section title="Finances" icon="bi-journal-text">
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Revenus',      value: fmtM(r.finances.income),  cls: 'bg-emerald-50 text-emerald-700', lbl: 'text-emerald-600' },
                  { label: 'Dépenses',     value: fmtM(r.finances.expense), cls: 'bg-red-50 text-red-700',         lbl: 'text-red-600' },
                  {
                    label: 'Résultat net',
                    value: (r.finances.net >= 0 ? '+' : '') + fmtM(r.finances.net),
                    cls: r.finances.net >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700',
                    lbl: r.finances.net >= 0 ? 'text-blue-600' : 'text-orange-600',
                  },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg p-3 ${item.cls}`}>
                    <p className={`text-[10px] uppercase tracking-wide font-semibold mb-1 ${item.lbl}`}>{item.label}</p>
                    <p className="text-sm font-bold leading-tight">{item.value}</p>
                  </div>
                ))}
              </div>
              <FinanceBar income={r.finances.income} expense={r.finances.expense} />
              {Object.keys(r.finances.by_category).length > 0 ? (
                <>
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mt-5 mb-2">Détail par catégorie</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left pb-2 text-gray-400 font-medium text-xs">Catégorie</th>
                          <th className="text-right pb-2 text-emerald-600 font-medium text-xs">Revenus</th>
                          <th className="text-right pb-2 text-red-600 font-medium text-xs">Dépenses</th>
                          <th className="text-right pb-2 text-gray-500 font-medium text-xs">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(r.finances.by_category).map(([key, row]) => {
                          const net = row.income - row.expense
                          return (
                            <tr key={key} className="border-b border-gray-50 last:border-0">
                              <td className="py-2 text-gray-700">{row.label}</td>
                              <td className="py-2 text-right text-emerald-700">{row.income ? fmtM(row.income) : '—'}</td>
                              <td className="py-2 text-right text-red-700">{row.expense ? fmtM(row.expense) : '—'}</td>
                              <td className={`py-2 text-right font-semibold ${net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                                {net >= 0 ? '+' : ''}{fmtM(net)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4 mt-4">Aucune transaction enregistrée ce mois-ci.</p>
              )}
            </Section>
          </div>

          {/* ── Satisfaction + Maintenance ── */}
          <div className="grid lg:grid-cols-2 gap-5">

            <Section title="Satisfaction clients" icon="bi-emoji-smile">
              {r.satisfaction.count === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
                  <i className="bi bi-clipboard-x text-3xl" />
                  <p className="text-sm">Aucun questionnaire soumis ce mois-ci.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-5">
                    <div className="relative w-20 h-20 shrink-0">
                      {(() => {
                        const v   = r.satisfaction.avg_overall ?? 0
                        const col = v >= 4 ? '#16a34a' : v >= 3 ? '#d97706' : '#dc2626'
                        return (
                          <>
                            <CircleGauge value={v} max={5} color={col} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-xl font-bold text-gray-900">{v.toFixed(1)}</span>
                              <span className="text-[10px] text-gray-400">/5</span>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">Note globale</p>
                      <p className="text-xs text-gray-400">{r.satisfaction.count} questionnaire{r.satisfaction.count > 1 ? 's' : ''} soumis</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden w-32">
                          <div className="h-full bg-emerald-400 rounded-full transition-all"
                            style={{ width: `${r.satisfaction.would_return_pct}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-emerald-600">{fmtPct(r.satisfaction.would_return_pct)}</span>
                        <span className="text-xs text-gray-400">souhaitent revenir</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-50 pt-3">
                    <ScoreBar label="Propreté"            value={r.satisfaction.avg_cleanliness} />
                    <ScoreBar label="Service"              value={r.satisfaction.avg_service} />
                    <ScoreBar label="Confort"              value={r.satisfaction.avg_comfort} />
                    <ScoreBar label="Rapport qualité/prix" value={r.satisfaction.avg_value} />
                  </div>
                </div>
              )}
            </Section>

            <Section title="Maintenance" icon="bi-tools">
              {r.maintenance.total === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
                  <i className="bi bi-check-circle text-3xl text-emerald-400" />
                  <p className="text-sm">Aucun ticket ce mois-ci.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Indicateurs</p>
                    <StatRow label="Total tickets"      value={String(r.maintenance.total)} highlight />
                    <StatRow label="En cours / Ouverts" value={String(r.maintenance.open)} valueClass="text-orange-600" />
                    <StatRow label="Résolus / Clôturés" value={String(r.maintenance.resolved)} valueClass="text-emerald-600" />
                    <StatRow label="Coût total"          value={fmtM(r.maintenance.cost)} highlight />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Par priorité</p>
                    {r.maintenance.by_priority.filter(p => p.count > 0).map(p => {
                      const pct = (p.count / r.maintenance.total) * 100
                      const col = p.key === 'urgent' ? '#dc2626' : p.key === 'high' ? '#ea580c' : p.key === 'medium' ? '#d97706' : '#16a34a'
                      return (
                        <div key={p.key} className="py-1.5 border-b border-gray-50 last:border-0">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">{p.label}</span>
                            <span className="font-semibold text-gray-800">{p.count}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: col }} />
                          </div>
                        </div>
                      )
                    })}
                    {r.maintenance.by_category.length > 0 && (
                      <>
                        <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-2 mt-3">Par catégorie</p>
                        {r.maintenance.by_category.map(c => (
                          <StatRow key={c.key} label={c.label} value={String(c.count)} />
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </Section>
          </div>

          {/* ── Housekeeping ── */}
          <Section title="Ménage des chambres" icon="bi-bucket">
            {r.housekeeping.total === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
                <i className="bi bi-house text-3xl" />
                <p className="text-sm">Aucune tâche planifiée ce mois-ci.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-4 items-center">
                <div className="sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Tâches</p>
                  <StatRow label="Total planifiées" value={String(r.housekeeping.total)} highlight />
                  <StatRow label="Terminées"        value={String(r.housekeeping.done)} valueClass="text-emerald-600" />
                  <StatRow label="En attente"       value={String(r.housekeeping.pending)} valueClass="text-orange-600" />
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>Taux de complétion</span>
                      <span className="font-bold text-gray-700">{r.housekeeping.completion_rate}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${r.housekeeping.completion_rate}%`,
                          backgroundColor: r.housekeeping.completion_rate >= 90 ? '#16a34a'
                            : r.housekeeping.completion_rate >= 70 ? '#d97706' : '#dc2626',
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="relative w-28 h-28">
                    {(() => {
                      const c = r.housekeeping.completion_rate
                      const col = c >= 90 ? '#16a34a' : c >= 70 ? '#d97706' : '#dc2626'
                      return (
                        <>
                          <CircleGauge value={c} max={100} color={col} />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-gray-900">{c}%</span>
                            <span className="text-[10px] text-gray-400">complétion</span>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )}
          </Section>
        </>
      )}

      {/* ── État vide initial ── */}
      {!r && !loading && !error && (
        <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
          <i className="bi bi-file-earmark-bar-graph text-5xl text-gray-200" />
          <p className="text-sm">Sélectionnez une période et cliquez sur Actualiser.</p>
        </div>
      )}
    </div>
  )
}
