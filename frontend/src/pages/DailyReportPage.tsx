import { useEffect, useState } from 'react'
import { SkeletonTablePage } from '../components/Skeleton'
import { bookingsApi, DailyBooking } from '../api/bookings'
import { formatFcfa } from '../utils'

interface DailyReport {
  date: string
  arrivals_expected: DailyBooking[]
  arrivals_done: DailyBooking[]
  departures_expected: DailyBooking[]
  departures_done: DailyBooking[]
  occupied: DailyBooking[]
  total_rooms: number
  occupied_count: number
  occupancy_rate: number
  daily_revenue: number
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmée', checked_in: 'En cours', checked_out: 'Parti(e)',
  pending: 'En attente', cancelled: 'Annulée', no_show: 'No show',
}

function BookingTable({ items, emptyMsg }: { items: DailyBooking[]; emptyMsg: string }) {
  if (!items.length) return <p className="text-sm text-gray-400 italic py-2">{emptyMsg}</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
          <th className="py-2 pr-3 font-medium">Référence</th>
          <th className="py-2 pr-3 font-medium">Client</th>
          <th className="py-2 pr-3 font-medium">Chambre</th>
          <th className="py-2 pr-3 font-medium">Départ</th>
          <th className="py-2 font-medium">Statut</th>
        </tr>
      </thead>
      <tbody>
        {items.map(b => (
          <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
            <td className="py-2 pr-3 font-mono text-xs text-hotel-gold">{b.reference}</td>
            <td className="py-2 pr-3">{b.client}</td>
            <td className="py-2 pr-3">#{b.room_number} <span className="text-gray-400 text-xs">({b.room_type})</span></td>
            <td className="py-2 pr-3 text-xs text-gray-500">{new Date(b.check_out).toLocaleDateString('fr-FR')}</td>
            <td className="py-2">
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                {STATUS_LABEL[b.status] ?? b.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Section({ title, icon, color, items, emptyMsg }: {
  title: string; icon: string; color: string; items: DailyBooking[]; emptyMsg: string
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-full ${color} flex items-center justify-center`}>
          <i className={`bi ${icon} text-white text-xs`} />
        </div>
        <h3 className="font-semibold text-gray-700">{title}</h3>
        <span className="ml-auto text-sm font-bold text-gray-500">{items.length}</span>
      </div>
      <BookingTable items={items} emptyMsg={emptyMsg} />
    </div>
  )
}

export default function DailyReportPage() {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(todayStr)
  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    bookingsApi.dailyReport(date)
      .then(setReport)
      .finally(() => setLoading(false))
  }, [date])

  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Rapport journalier</h1>
          {report && <p className="text-sm text-gray-500 capitalize">{fmt(report.date)}</p>}
        </div>
        <div className="flex items-center gap-2">
          <i className="bi bi-calendar3 text-gray-400" />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input-box py-1.5 text-sm"
          />
          {date !== todayStr && (
            <button onClick={() => setDate(todayStr)} className="btn-secondary text-sm py-1.5 px-3">
              Aujourd'hui
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonTablePage cardCount={4} rows={5} cols={4} withToolbar={false} />
      ) : report ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Arrivées</p>
              <p className="text-3xl font-bold text-green-600">
                {report.arrivals_done.length}
                <span className="text-lg text-gray-400">/{report.arrivals_expected.length + report.arrivals_done.length}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">effectuées / attendues</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Départs</p>
              <p className="text-3xl font-bold text-blue-600">
                {report.departures_done.length}
                <span className="text-lg text-gray-400">/{report.departures_expected.length + report.departures_done.length}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">effectués / attendus</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Occupation</p>
              <p className="text-3xl font-bold text-hotel-gold">
                {report.occupancy_rate}
                <span className="text-lg">%</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{report.occupied_count} / {report.total_rooms} chambres</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Revenus du jour</p>
              <p className="text-2xl font-bold text-gray-800">{formatFcfa(report.daily_revenue)}</p>
              <p className="text-xs text-gray-400 mt-0.5">factures payées</p>
            </div>
          </div>

          {/* 4 sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section
              title="Arrivées attendues"
              icon="bi-box-arrow-in-right"
              color="bg-yellow-500"
              items={report.arrivals_expected}
              emptyMsg="Aucune arrivée attendue"
            />
            <Section
              title="Arrivées effectuées"
              icon="bi-check-circle"
              color="bg-green-500"
              items={report.arrivals_done}
              emptyMsg="Aucun check-in effectué"
            />
            <Section
              title="Départs attendus"
              icon="bi-box-arrow-right"
              color="bg-blue-500"
              items={report.departures_expected}
              emptyMsg="Aucun départ attendu"
            />
            <Section
              title="Départs effectués"
              icon="bi-check2-all"
              color="bg-gray-400"
              items={report.departures_done}
              emptyMsg="Aucun check-out effectué"
            />
          </div>

          {/* Occupied rooms */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-hotel-gold flex items-center justify-center">
                <i className="bi bi-door-open text-white text-xs" />
              </div>
              <h3 className="font-semibold text-gray-700">Chambres actuellement occupées</h3>
              <span className="ml-auto text-sm font-bold text-gray-500">{report.occupied.length}</span>
            </div>
            <BookingTable items={report.occupied} emptyMsg="Aucune chambre occupée" />
          </div>
        </>
      ) : null}
    </div>
  )
}
