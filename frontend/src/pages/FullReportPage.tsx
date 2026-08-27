import { useEffect, useState } from 'react'
import { reportsApi, FullReport, RoomEntry } from '../api/reports'
import { getContent } from '../api/content'
import { generateFullReportPdf } from '../utils/pdfReport'

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

function fmt(n: number, dec = 0): string {
  const abs = Math.abs(n)
  const p = abs.toFixed(dec).split('.')
  p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const b = dec > 0 ? p[0] + ',' + (p[1] ?? '0') : p[0]
  return n < 0 ? '- ' + b : b
}
const fmtM   = (n: number) => fmt(n) + ' FCFA'
const fmtPct = (n: number) => fmt(n, 1) + ' %'

/* ── Petits composants ──────────────────────────────────────────────────── */

function SectionHeader({ id, icon, title, count }: { id: string; icon: string; title: string; count?: number }) {
  return (
    <div id={id} className="flex items-center gap-3 mb-4 pt-1">
      <div className="w-9 h-9 rounded-xl bg-hotel-gold/10 flex items-center justify-center shrink-0">
        <i className={`bi ${icon} text-hotel-gold`} />
      </div>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {count !== undefined && (
        <span className="ml-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs font-semibold text-gray-500">{count}</span>
      )}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>{children}</div>
}

function VipBadge({ status }: { status: string }) {
  if (status === 'vvip') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">
      <i className="bi bi-star-fill text-[8px]" /> VVIP
    </span>
  )
  if (status === 'vip') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 uppercase tracking-wider">
      <i className="bi bi-star text-[8px]" /> VIP
    </span>
  )
  return null
}

const ROOM_STATUS_CONFIG: Record<string, { bg: string; dot: string; text: string; icon: string }> = {
  available:   { bg: 'bg-emerald-50 border-emerald-200',  dot: 'bg-emerald-400', text: 'text-emerald-700', icon: 'bi-check-circle' },
  occupied:    { bg: 'bg-blue-50 border-blue-200',        dot: 'bg-blue-500',    text: 'text-blue-700',    icon: 'bi-person-fill' },
  maintenance: { bg: 'bg-red-50 border-red-200',          dot: 'bg-red-400',     text: 'text-red-700',     icon: 'bi-tools' },
  cleaning:    { bg: 'bg-amber-50 border-amber-200',      dot: 'bg-amber-400',   text: 'text-amber-700',   icon: 'bi-bucket' },
}

function RoomCard({ room }: { room: RoomEntry }) {
  const cfg = ROOM_STATUS_CONFIG[room.status] ?? { bg: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400', text: 'text-gray-600', icon: 'bi-dash' }
  return (
    <div className={`border rounded-xl p-3 flex flex-col gap-1.5 min-w-0 ${cfg.bg}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold text-gray-900 text-base leading-none">{room.number}</span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      </div>
      <span className="text-[11px] text-gray-500 truncate">{room.type}</span>
      <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${cfg.text}`}>
        <i className={`bi ${cfg.icon} text-[9px]`} />
        {room.status_label}
      </div>
      {room.current_guest && (
        <div className="mt-0.5 pt-1.5 border-t border-current/10">
          <p className="text-[11px] font-medium text-gray-700 truncate">{room.current_guest}</p>
          {room.check_out && (
            <p className="text-[10px] text-gray-400">
              → {new Date(room.check_out).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function HBar({ pct, color = 'bg-hotel-gold', height = 'h-2' }: { pct: number; color?: string; height?: string }) {
  return (
    <div className={`w-full ${height} bg-gray-100 rounded-full overflow-hidden`}>
      <div className={`${height} ${color} rounded-full transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────── */

const SECTIONS = [
  { id: 's-rooms',     icon: 'bi-door-open',             label: 'Chambres' },
  { id: 's-concluded', icon: 'bi-bookmark-check',        label: 'Réservations' },
  { id: 's-vip',       icon: 'bi-star',                  label: 'Clients VIP' },
  { id: 's-finance',   icon: 'bi-journal-text',          label: 'Finances' },
  { id: 's-ops',       icon: 'bi-grid-1x2',              label: 'Opérations' },
]

export default function FullReportPage() {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [report,    setReport]    = useState<FullReport | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [hotelName, setHotelName] = useState('Mon Hôtel')
  const [bookingSearch, setBookingSearch] = useState('')

  useEffect(() => {
    getContent().then(c => setHotelName(c.hotel.name || 'Mon Hôtel')).catch(() => {})
  }, [])

  const load = async (y: number, m: number) => {
    setLoading(true); setError('')
    try { setReport(await reportsApi.full(y, m)) }
    catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; detail?: string; traceback?: string } }; message?: string }
      const msg = err?.response?.data?.error || err?.response?.data?.detail || err?.message || 'Impossible de charger le rapport.'
      setError(msg)
      console.error('[FullReport] load error:', e)
    }
    finally { setLoading(false) }
  }

  useEffect(() => { load(year, month) }, [])

  const changeMonth = (m: number) => { setMonth(m); load(year, m) }
  const changeYear  = (y: number) => { setYear(y);  load(y, month) }

  const yearOptions = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i)

  const r = report

  const filteredBookings = r
    ? r.concluded.list.filter(b =>
        !bookingSearch ||
        b.client_name.toLowerCase().includes(bookingSearch.toLowerCase()) ||
        b.reference.toLowerCase().includes(bookingSearch.toLowerCase()) ||
        b.room_number.includes(bookingSearch)
      )
    : []

  return (
    <div className="p-4 space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Bilan mensuel</h1>
          <p className="text-sm text-gray-400 mt-0.5">Chambres · Réservations · VIP · Finances</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
            value={month} onChange={e => changeMonth(Number(e.target.value))}>
            {MONTHS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
            value={year} onChange={e => changeYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => load(year, month)} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-hotel-gold text-white hover:bg-amber-600 disabled:opacity-60 transition-colors shadow-sm">
            <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Chargement…' : 'Actualiser'}
          </button>
          {r && !loading && (
            <button
              onClick={() => generateFullReportPdf(r, hotelName)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-hotel-dark text-hotel-gold hover:bg-gray-900 transition-colors shadow-sm border border-hotel-gold/30">
              <i className="bi bi-printer" />
              Imprimer
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <i className="bi bi-exclamation-triangle-fill" /> Erreur de chargement
          </div>
          <pre className="whitespace-pre-wrap break-all text-xs text-red-600 mt-1 max-h-48 overflow-y-auto">{error}</pre>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-24">
          <div className="w-10 h-10 rounded-full border-4 border-hotel-gold border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400">Compilation du rapport…</p>
        </div>
      )}

      {r && !loading && (
        <>
          {/* ── Bandeau synthèse ── */}
          <div className="rounded-2xl overflow-hidden bg-hotel-dark text-white">
            <div className="px-6 py-4 flex flex-wrap items-center gap-2 justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-hotel-gold/20 flex items-center justify-center">
                  <i className="bi bi-building text-hotel-gold text-lg" />
                </div>
                <div>
                  <p className="text-xs text-amber-300 uppercase tracking-widest font-semibold">{hotelName}</p>
                  <p className="font-bold text-xl">{r.period.label}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {SECTIONS.map(s => (
                  <a key={s.id} href={`#${s.id}`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors">
                    <i className={`bi ${s.icon}`} /> {s.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-white/10">
              {[
                { label: 'Revenus', value: fmtM(r.finances.income), icon: 'bi-graph-up-arrow', color: 'text-emerald-400' },
                { label: 'Occupation', value: fmtPct(r.rooms.occupancy_pct), icon: 'bi-house-check', color: 'text-blue-300' },
                { label: 'Réservations conclues', value: String(r.concluded.total), icon: 'bi-bookmark-check-fill', color: 'text-amber-300' },
                { label: 'Résultat net', value: fmtM(r.finances.net), icon: 'bi-wallet2', color: r.finances.net >= 0 ? 'text-emerald-400' : 'text-red-400' },
              ].map(item => (
                <div key={item.label} className="px-5 py-4">
                  <p className="text-[11px] text-white/50 uppercase tracking-widest mb-1">{item.label}</p>
                  <p className={`font-bold text-xl ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ════════════════════════════════════════════
              1. ÉTAT DES CHAMBRES
          ════════════════════════════════════════════ */}
          <section>
            <SectionHeader id="s-rooms" icon="bi-door-open" title="État des chambres" count={r.rooms.total} />

            {/* Stats rapides */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Disponibles',  val: r.rooms.available,   color: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-400' },
                { label: 'Occupées',     val: r.rooms.occupied,    color: 'text-blue-600',    bg: 'bg-blue-50',    bar: 'bg-blue-400' },
                { label: 'Maintenance',  val: r.rooms.maintenance, color: 'text-red-600',     bg: 'bg-red-50',     bar: 'bg-red-400' },
                { label: 'Nettoyage',    val: r.rooms.cleaning,    color: 'text-amber-600',   bg: 'bg-amber-50',   bar: 'bg-amber-400' },
              ].map(item => (
                <Card key={item.label} className="p-4">
                  <p className={`text-3xl font-bold ${item.color}`}>{item.val}</p>
                  <p className="text-xs text-gray-500 mt-0.5 mb-2">{item.label}</p>
                  <HBar pct={r.rooms.total > 0 ? item.val / r.rooms.total * 100 : 0} color={item.bar} />
                </Card>
              ))}
            </div>

            {/* Grille par étage */}
            {r.rooms.by_floor.map(floor => (
              <Card key={floor.floor} className="mb-3">
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{floor.label}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{floor.total} chambre{floor.total > 1 ? 's' : ''}</span>
                  <div className="ml-auto flex gap-3 text-xs">
                    {floor.available > 0   && <span className="text-emerald-600 font-medium">{floor.available} dispo</span>}
                    {floor.occupied > 0    && <span className="text-blue-600 font-medium">{floor.occupied} occupée{floor.occupied > 1 ? 's' : ''}</span>}
                    {floor.maintenance > 0 && <span className="text-red-600 font-medium">{floor.maintenance} maint.</span>}
                    {floor.cleaning > 0    && <span className="text-amber-600 font-medium">{floor.cleaning} nettoyage</span>}
                  </div>
                </div>
                <div className="p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {r.rooms.list
                    .filter(room => room.floor === floor.floor)
                    .map(room => <RoomCard key={room.id} room={room} />)
                  }
                </div>
              </Card>
            ))}
          </section>

          {/* ════════════════════════════════════════════
              2. RÉSERVATIONS CONCLUES
          ════════════════════════════════════════════ */}
          <section>
            <SectionHeader id="s-concluded" icon="bi-bookmark-check" title="Réservations conclues" count={r.concluded.total} />

            <div className="grid grid-cols-3 gap-3 mb-4">
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{r.concluded.total}</p>
                <p className="text-xs text-gray-500 mt-0.5">Séjours terminés</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{fmtM(r.concluded.revenue)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Revenu généré</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{r.concluded.avg_stay} nuits</p>
                <p className="text-xs text-gray-500 mt-0.5">Durée moyenne</p>
              </Card>
            </div>

            <Card>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                <div className="relative flex-1 max-w-xs">
                  <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text" placeholder="Rechercher un client, référence, chambre…"
                    value={bookingSearch} onChange={e => setBookingSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <span className="text-xs text-gray-400">{filteredBookings.length} résultat{filteredBookings.length > 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Référence</th>
                      <th className="text-left px-4 py-2.5 font-medium">Client</th>
                      <th className="text-left px-4 py-2.5 font-medium">Chambre</th>
                      <th className="text-left px-4 py-2.5 font-medium">Check-in</th>
                      <th className="text-left px-4 py-2.5 font-medium">Check-out</th>
                      <th className="text-right px-4 py-2.5 font-medium">Nuits</th>
                      <th className="text-right px-4 py-2.5 font-medium">Montant</th>
                      <th className="text-left px-4 py-2.5 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredBookings.slice(0, 50).map(b => (
                      <tr key={b.reference} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{b.reference}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{b.client_name}</span>
                            <VipBadge status={b.vip_status} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-gray-700">{b.room_number}</span>
                          <span className="text-xs text-gray-400 ml-1">{b.room_type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                          {new Date(b.check_in).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                          {new Date(b.check_out).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{b.nights}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmtM(b.total_price)}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600 font-medium">{b.source}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredBookings.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-8">Aucune réservation trouvée.</p>
                )}
              </div>
            </Card>
          </section>

          {/* ════════════════════════════════════════════
              3. CLIENTS VIP
          ════════════════════════════════════════════ */}
          <section>
            <SectionHeader id="s-vip" icon="bi-star" title="Clients VIP" count={r.vip.vip_count + r.vip.vvip_count} />

            {r.vip.list.length === 0 ? (
              <Card className="p-8 text-center text-sm text-gray-400">
                <i className="bi bi-star text-3xl text-gray-200 block mb-2" />
                Aucun client VIP enregistré.
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {r.vip.list.map(client => {
                  const isVVIP = client.vip_status === 'vvip'
                  return (
                    <Card key={client.id} className={`overflow-hidden ${isVVIP ? 'ring-1 ring-amber-300' : ''}`}>
                      <div className={`h-1.5 ${isVVIP ? 'bg-gradient-to-r from-amber-400 to-yellow-300' : 'bg-violet-400'}`} />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <VipBadge status={client.vip_status} />
                              {client.stayed_this_period && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-700 font-semibold uppercase">
                                  Ce mois
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-gray-900 text-base">{client.name}</p>
                            {client.nationality && (
                              <p className="text-xs text-gray-400">{client.nationality}</p>
                            )}
                          </div>
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-lg
                            ${isVVIP ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
                            {client.name.charAt(0)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-xl font-bold text-gray-900">{client.total_stays}</p>
                            <p className="text-[10px] text-gray-400">séjours</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-sm font-bold text-gray-900 leading-tight">{fmtM(client.total_spent)}</p>
                            <p className="text-[10px] text-gray-400">dépensé</p>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-gray-500">
                          {client.last_stay && (
                            <div className="flex items-center gap-1.5">
                              <i className="bi bi-calendar-event text-gray-300" />
                              Dernier séjour : {new Date(client.last_stay).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                              {client.last_room && <span className="text-gray-400">· Ch. {client.last_room}</span>}
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center gap-1.5 truncate">
                              <i className="bi bi-envelope text-gray-300" />
                              <span className="truncate">{client.email}</span>
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-1.5">
                              <i className="bi bi-telephone text-gray-300" />
                              {client.phone}
                            </div>
                          )}
                          {client.preferences && (
                            <div className="flex items-start gap-1.5 mt-1 pt-1 border-t border-gray-100">
                              <i className="bi bi-stars text-amber-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2 text-gray-600">{client.preferences}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          {/* ════════════════════════════════════════════
              4. POINT FINANCIER DÉTAILLÉ
          ════════════════════════════════════════════ */}
          <section>
            <SectionHeader id="s-finance" icon="bi-journal-text" title="Point financier détaillé" />

            {/* KPIs finance */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Card className="p-4 bg-emerald-50/60">
                <p className="text-xs text-emerald-600 font-semibold uppercase tracking-widest mb-1">Revenus</p>
                <p className="text-2xl font-bold text-emerald-700">{fmtM(r.finances.income)}</p>
              </Card>
              <Card className="p-4 bg-red-50/60">
                <p className="text-xs text-red-600 font-semibold uppercase tracking-widest mb-1">Dépenses</p>
                <p className="text-2xl font-bold text-red-700">{fmtM(r.finances.expense)}</p>
              </Card>
              <Card className={`p-4 ${r.finances.net >= 0 ? 'bg-blue-50/60' : 'bg-orange-50/60'}`}>
                <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${r.finances.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  Résultat net
                </p>
                <p className={`text-2xl font-bold ${r.finances.net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {r.finances.net >= 0 ? '+' : ''}{fmtM(r.finances.net)}
                </p>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-4 mb-4">

              {/* Revenus par catégorie */}
              <Card>
                <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                  <i className="bi bi-graph-up text-emerald-500 text-sm" />
                  <h3 className="font-semibold text-gray-700 text-sm">Revenus par catégorie</h3>
                </div>
                <div className="p-5 space-y-3">
                  {r.finances.income_by_category.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Aucun revenu ce mois-ci.</p>
                  )}
                  {r.finances.income_by_category.map(cat => (
                    <div key={cat.key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium">{cat.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-700">{fmtM(cat.amount)}</span>
                          <span className="text-xs text-gray-400 w-8 text-right">{cat.pct}%</span>
                        </div>
                      </div>
                      <HBar pct={cat.pct} color="bg-emerald-400" height="h-2" />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Dépenses vs budget */}
              <Card>
                <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                  <i className="bi bi-bar-chart text-red-500 text-sm" />
                  <h3 className="font-semibold text-gray-700 text-sm">Dépenses vs budget</h3>
                </div>
                <div className="p-5 space-y-3">
                  {r.finances.expense_by_category.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Aucune dépense ce mois-ci.</p>
                  )}
                  {r.finances.expense_by_category.map(cat => (
                    <div key={cat.key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`font-medium ${cat.over_budget ? 'text-red-700' : 'text-gray-700'}`}>{cat.label}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${cat.over_budget ? 'text-red-700' : 'text-gray-800'}`}>{fmtM(cat.amount)}</span>
                          {cat.budget_pct !== null && (
                            <span className={`text-xs font-semibold w-10 text-right ${cat.over_budget ? 'text-red-600' : 'text-gray-400'}`}>
                              {cat.budget_pct}%
                            </span>
                          )}
                          {cat.over_budget && <i className="bi bi-exclamation-triangle-fill text-red-500 text-xs" />}
                        </div>
                      </div>
                      <div className="relative">
                        {cat.budget !== null && (
                          <div className="w-full h-2 bg-gray-100 rounded-full mb-0.5 relative overflow-hidden">
                            {/* Budget bar (light) */}
                            <div className="absolute inset-0 bg-gray-200 rounded-full" />
                            {/* Spent bar */}
                            <div
                              className={`absolute top-0 left-0 h-full rounded-full transition-all ${cat.over_budget ? 'bg-red-400' : 'bg-amber-400'}`}
                              style={{ width: `${Math.min(cat.budget_pct ?? 0, 100)}%` }}
                            />
                          </div>
                        )}
                        {cat.budget === null && <HBar pct={cat.pct} color="bg-red-300" height="h-2" />}
                      </div>
                      {cat.budget !== null && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Budget : {fmtM(cat.budget)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-4 mb-4">

              {/* Moyens de paiement */}
              <Card>
                <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                  <i className="bi bi-credit-card text-blue-500 text-sm" />
                  <h3 className="font-semibold text-gray-700 text-sm">Modes de paiement</h3>
                </div>
                <div className="p-4 space-y-2">
                  {r.finances.payment_methods.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Aucune transaction.</p>
                  )}
                  {r.finances.payment_methods.map(pm => (
                    <div key={pm.method} className="flex items-center gap-2">
                      <div className="w-1.5 h-8 bg-hotel-gold rounded-full shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700 truncate">{pm.label}</span>
                          <span className="font-semibold text-gray-900 ml-2 shrink-0">{fmtM(pm.amount)}</span>
                        </div>
                        <HBar pct={pm.pct} color="bg-hotel-gold/60" height="h-1" />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right shrink-0">{pm.pct}%</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Factures */}
              {r.finances.invoices && (
                <Card>
                  <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                    <i className="bi bi-receipt text-violet-500 text-sm" />
                    <h3 className="font-semibold text-gray-700 text-sm">Factures</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {[
                      { label: 'Total émises', val: String(r.finances.invoices.total), cls: 'text-gray-700' },
                      { label: 'Payées',        val: String(r.finances.invoices.paid),  cls: 'text-emerald-700 font-semibold' },
                      { label: 'En attente',    val: String(r.finances.invoices.issued + r.finances.invoices.draft), cls: 'text-amber-700' },
                      { label: 'Annulées',      val: String(r.finances.invoices.cancelled), cls: 'text-red-600' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                        <span className="text-gray-500">{row.label}</span>
                        <span className={row.cls}>{row.val}</span>
                      </div>
                    ))}
                    <div className="pt-2 mt-1 border-t border-gray-100">
                      <p className="text-xs text-gray-400">Montant total facturé</p>
                      <p className="font-bold text-gray-900">{fmtM(r.finances.invoices.total_amount)}</p>
                      <p className="text-xs text-gray-400 mt-1">Dont encaissé</p>
                      <p className="font-bold text-emerald-700">{fmtM(r.finances.invoices.paid_amount)}</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Courbe journalière */}
              {r.finances.daily_curve.length > 0 && (
                <Card className={r.finances.invoices ? '' : 'lg:col-span-2'}>
                  <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                    <i className="bi bi-activity text-emerald-500 text-sm" />
                    <h3 className="font-semibold text-gray-700 text-sm">Revenus journaliers</h3>
                  </div>
                  <div className="p-4">
                    {(() => {
                      const vals    = r.finances.daily_curve.map(d => d.amount)
                      const maxVal  = Math.max(...vals, 1)
                      const hasData = vals.some(v => v > 0)
                      if (!hasData) return (
                        <p className="text-sm text-gray-400 text-center py-6">Aucun revenu enregistré.</p>
                      )
                      return (
                        <div className="flex items-end gap-0.5 h-24">
                          {r.finances.daily_curve.map((d, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative"
                              title={`${new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : ${fmtM(d.amount)}`}>
                              <div
                                className="w-full rounded-sm bg-emerald-400/70 hover:bg-emerald-500 transition-all cursor-default"
                                style={{ height: `${Math.max((d.amount / maxVal) * 88, d.amount > 0 ? 4 : 1)}px` }}
                              />
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>1er</span>
                      <span>{r.finances.daily_curve.length}</span>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Top transactions */}
            {r.finances.top_transactions.length > 0 && (
              <Card>
                <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                  <i className="bi bi-list-ol text-gray-400 text-sm" />
                  <h3 className="font-semibold text-gray-700 text-sm">Top 10 transactions</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {r.finances.top_transactions.map((tx, i) => (
                    <div key={tx.reference} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-xs font-bold text-gray-300 w-5 shrink-0">{i + 1}</span>
                      <div className={`w-1.5 h-8 rounded-full shrink-0 ${tx.type === 'income' ? 'bg-emerald-400' : 'bg-red-300'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">{tx.description || tx.label}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">{tx.label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          <span>{new Date(tx.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                          <span>·</span>
                          <span>{tx.payment_method}</span>
                          <span className="font-mono text-gray-300">{tx.reference}</span>
                        </div>
                      </div>
                      <span className={`font-bold text-sm shrink-0 ${tx.type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmtM(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </section>

          {/* ════════════════════════════════════════════
              5. OPÉRATIONS (Satisfaction · Maintenance · Ménage)
          ════════════════════════════════════════════ */}
          <section>
            <SectionHeader id="s-ops" icon="bi-grid-1x2" title="Opérations" />

            <div className="grid lg:grid-cols-3 gap-4">

              {/* Satisfaction */}
              <Card>
                <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                  <i className="bi bi-emoji-smile text-amber-500 text-sm" />
                  <h3 className="font-semibold text-gray-700 text-sm">Satisfaction</h3>
                </div>
                <div className="p-4">
                  {r.satisfaction.count === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Aucun avis ce mois.</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        {(() => {
                          const v = r.satisfaction.avg_overall ?? 0
                          const col = v >= 4 ? '#16a34a' : v >= 3 ? '#d97706' : '#dc2626'
                          return (
                            <>
                              <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl shrink-0"
                                style={{ background: col + '20', color: col }}>
                                {v.toFixed(1)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">Note globale</p>
                                <p className="text-xs text-gray-400">{r.satisfaction.count} questionnaire{r.satisfaction.count > 1 ? 's' : ''}</p>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                      {[
                        { label: 'Propreté',      val: r.satisfaction.avg_cleanliness },
                        { label: 'Service',        val: r.satisfaction.avg_service },
                        { label: 'Confort',        val: r.satisfaction.avg_comfort },
                        { label: 'Qualité/prix',   val: r.satisfaction.avg_value },
                      ].map(s => s.val !== null && (
                        <div key={s.label} className="flex items-center gap-2 py-1">
                          <span className="text-xs text-gray-500 w-24 shrink-0">{s.label}</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${(s.val / 5) * 100}%` }} />
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-6 text-right">{s.val!.toFixed(1)}</span>
                        </div>
                      ))}
                      <div className="mt-3 pt-2 border-t border-gray-50 flex items-center gap-2 text-sm">
                        <HBar pct={r.satisfaction.would_return_pct} color="bg-emerald-400" />
                        <span className="font-semibold text-emerald-600 whitespace-nowrap">{fmtPct(r.satisfaction.would_return_pct)}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">souhaitent revenir</p>
                    </>
                  )}
                </div>
              </Card>

              {/* Maintenance */}
              <Card>
                <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                  <i className="bi bi-tools text-gray-500 text-sm" />
                  <h3 className="font-semibold text-gray-700 text-sm">Maintenance</h3>
                </div>
                <div className="p-4">
                  {r.maintenance.total === 0 ? (
                    <div className="flex flex-col items-center gap-1 py-4 text-gray-400">
                      <i className="bi bi-check-circle text-2xl text-emerald-400" />
                      <p className="text-sm">Aucun ticket ce mois.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: 'Total',   val: r.maintenance.total,    cls: 'text-gray-700' },
                          { label: 'Ouverts', val: r.maintenance.open,     cls: 'text-orange-600' },
                          { label: 'Résolus', val: r.maintenance.resolved, cls: 'text-emerald-600' },
                        ].map(item => (
                          <div key={item.label} className="text-center bg-gray-50 rounded-lg p-2">
                            <p className={`text-xl font-bold ${item.cls}`}>{item.val}</p>
                            <p className="text-[10px] text-gray-400">{item.label}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">Coût total : <span className="font-semibold text-gray-800">{fmtM(r.maintenance.cost)}</span></p>
                      <div className="space-y-1.5">
                        {r.maintenance.by_priority.filter(p => p.count > 0).map(p => {
                          const col = p.key === 'urgent' ? 'bg-red-400' : p.key === 'high' ? 'bg-orange-400' : p.key === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'
                          return (
                            <div key={p.key} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500 w-14 shrink-0">{p.label}</span>
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full ${col} rounded-full`} style={{ width: `${(p.count / r.maintenance.total) * 100}%` }} />
                              </div>
                              <span className="font-semibold text-gray-700 w-4 text-right">{p.count}</span>
                            </div>
                          )
                        })}
                      </div>
                      {r.maintenance.urgent_open.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-red-100">
                          <p className="text-[10px] text-red-600 font-semibold uppercase tracking-wide mb-1.5">
                            <i className="bi bi-exclamation-triangle-fill mr-1" />Urgents ouverts
                          </p>
                          {r.maintenance.urgent_open.map(t => (
                            <div key={t.reference} className="text-xs text-gray-600 py-0.5 truncate">{t.title}</div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>

              {/* Housekeeping */}
              <Card>
                <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                  <i className="bi bi-bucket text-blue-400 text-sm" />
                  <h3 className="font-semibold text-gray-700 text-sm">Ménage</h3>
                </div>
                <div className="p-4">
                  {r.housekeeping.total === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Aucune tâche ce mois.</p>
                  ) : (
                    <>
                      <div className="flex justify-center mb-4">
                        <div className="relative w-28 h-28">
                          {(() => {
                            const c   = r.housekeeping.completion_rate
                            const col = c >= 90 ? '#16a34a' : c >= 70 ? '#d97706' : '#dc2626'
                            const r2  = 42, circ = 2 * Math.PI * r2
                            const pct = Math.min(c / 100, 1)
                            return (
                              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                <circle cx="50" cy="50" r={r2} fill="none" stroke="#f3f4f6" strokeWidth="7" />
                                <circle cx="50" cy="50" r={r2} fill="none" stroke={col} strokeWidth="7"
                                  strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`} strokeLinecap="round" />
                                <text x="50" y="50" textAnchor="middle" dominantBaseline="middle"
                                  className="rotate-90" style={{ transform: 'rotate(90deg)', transformOrigin: '50px 50px' }}
                                  fill={col} fontSize="18" fontWeight="bold">{c}%</text>
                              </svg>
                            )
                          })()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        {[
                          { label: 'Total tâches', val: r.housekeeping.total, cls: 'text-gray-700' },
                          { label: 'Terminées',    val: r.housekeeping.done,  cls: 'text-emerald-600' },
                          { label: 'En attente',   val: r.housekeeping.pending, cls: 'text-orange-600' },
                        ].map(item => (
                          <div key={item.label} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                            <span className="text-gray-500">{item.label}</span>
                            <span className={`font-semibold ${item.cls}`}>{item.val}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </div>
          </section>
        </>
      )}

      {!r && !loading && !error && (
        <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
          <i className="bi bi-building text-5xl text-gray-200" />
          <p className="text-sm">Sélectionnez une période pour générer le rapport complet.</p>
        </div>
      )}
    </div>
  )
}
