import { useEffect, useState } from 'react'
import { SkeletonRoomsGrid } from '../components/Skeleton'
import { roomsApi } from '../api/rooms'
import { Room } from '../types'

const STATUS_CONFIG = {
  available:   { label: 'Disponible',   bg: 'bg-green-50 dark:bg-green-900/30',  border: 'border-green-200 dark:border-green-800',  text: 'text-green-700 dark:text-green-300',  dot: 'bg-green-500'  },
  occupied:    { label: 'Occupée',      bg: 'bg-amber-50 dark:bg-amber-900/30',  border: 'border-amber-200 dark:border-amber-800',  text: 'text-amber-700 dark:text-amber-300',  dot: 'bg-amber-500'  },
  cleaning:    { label: 'En nettoyage', bg: 'bg-blue-50 dark:bg-blue-900/30',   border: 'border-blue-200 dark:border-blue-800',   text: 'text-blue-700 dark:text-blue-300',   dot: 'bg-blue-500'   },
  maintenance: { label: 'Maintenance',  bg: 'bg-red-50 dark:bg-red-900/30',    border: 'border-red-200 dark:border-red-800',    text: 'text-red-700 dark:text-red-300',    dot: 'bg-red-500'    },
} as const

const FLOOR_LABELS: Record<number, string> = {
  0: 'Rez-de-chaussée',
  1: '1er étage',
  2: '2ème étage',
  3: '3ème étage',
  4: '4ème étage',
}

function RoomCard({ room }: { room: Room }) {
  const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.available
  return (
    <div className={`rounded-xl border-2 ${cfg.bg} ${cfg.border} p-3 flex flex-col gap-1 min-w-[120px]`}>
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-gray-800 dark:text-gray-100">#{room.number}</span>
        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{room.room_type_name}</p>
      <span className={`text-xs font-medium ${cfg.text} mt-auto`}>{cfg.label}</span>
    </div>
  )
}

export default function RoomMapPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    roomsApi.list({ page_size: '200' })
      .then(d => setRooms(d.results))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? rooms : rooms.filter(r => r.status === filter)

  const floors = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b)

  const counts = {
    available:   rooms.filter(r => r.status === 'available').length,
    occupied:    rooms.filter(r => r.status === 'occupied').length,
    cleaning:    rooms.filter(r => r.status === 'cleaning').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Plan des chambres</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500">{rooms.length} chambre{rooms.length > 1 ? 's' : ''} au total</p>
      </div>

      {/* Legend + filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${
            filter === 'all' ? 'bg-gray-800 dark:bg-gray-700 text-white border-gray-800 dark:border-gray-700' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          Toutes <span className="font-bold">{rooms.length}</span>
        </button>
        {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG.available][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${
              filter === key
                ? `${cfg.bg} ${cfg.border} ${cfg.text} font-semibold`
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {cfg.label}
            <span className="font-bold">{counts[key as keyof typeof counts]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonRoomsGrid count={12} />
      ) : (
        <div className="space-y-6">
          {floors.map(floor => {
            const floorRooms = filtered.filter(r => r.floor === floor)
            if (!floorRooms.length) return null
            return (
              <div key={floor}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="font-semibold text-gray-700 dark:text-gray-300">{FLOOR_LABELS[floor] ?? `Étage ${floor}`}</h2>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">{floorRooms.length} chambre{floorRooms.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {floorRooms.map(room => <RoomCard key={room.id} room={room} />)}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="card p-8 text-center text-gray-400 dark:text-gray-500">
              <i className="bi bi-door-closed text-3xl block mb-2" />
              Aucune chambre dans cette catégorie
            </div>
          )}
        </div>
      )}
    </div>
  )
}
