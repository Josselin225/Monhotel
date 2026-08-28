import api from './client'

export type AmenityType = 'restaurant' | 'conference' | 'pool' | 'spa'

export interface AmenityReservation {
  id: number
  amenity: AmenityType
  amenity_display: string
  client: number | null
  client_full_name: string | null
  client_name: string
  client_phone: string
  date: string
  start_time: string
  end_time: string | null
  party_size: number
  detail: string
  price: string | null
  status: string
  status_display: string
  source: string
  source_display: string
  notes: string
  can_delete: boolean
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface MenuItem {
  id: number
  name: string
  description: string
  category: string
  category_display: string
  price: string
  is_available: boolean
  created_at: string
}

export const MENU_CATEGORIES = [
  { value: 'starter', label: 'Entrée' },
  { value: 'main',    label: 'Plat principal' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'drink',   label: 'Boisson' },
]

export interface AmenityStats {
  total: number
  today: number
  pending: number
  confirmed: number
}

export const AMENITY_META: Record<AmenityType, { label: string; icon: string; detailLabel: string; detailPlaceholder: string }> = {
  restaurant: { label: 'Restaurant',            icon: 'bi-cup-hot', detailLabel: 'Table',       detailPlaceholder: 'Ex: Table 4' },
  conference: { label: 'Salle de conférence',   icon: 'bi-easel',   detailLabel: 'Disposition', detailPlaceholder: 'Ex: Théâtre, 40 places' },
  pool:       { label: 'Piscine',               icon: 'bi-water',   detailLabel: 'Zone',        detailPlaceholder: 'Ex: Transats VIP' },
  spa:        { label: 'Spa',                   icon: 'bi-flower1', detailLabel: 'Soin',        detailPlaceholder: 'Ex: Massage relaxant 60 min' },
}

export const STATUS_OPTIONS = [
  { value: 'pending',   label: 'En attente' },
  { value: 'confirmed', label: 'Confirmée' },
  { value: 'cancelled', label: 'Annulée' },
  { value: 'completed', label: 'Terminée' },
]

export const STATUS_COLORS: Record<string, string> = {
  pending:   'text-amber-700 bg-amber-50 border-amber-200',
  confirmed: 'text-blue-700 bg-blue-50 border-blue-200',
  cancelled: 'text-gray-500 bg-gray-100 border-gray-200',
  completed: 'text-green-700 bg-green-50 border-green-200',
}

export const amenityApi = {
  list: async (params: Record<string, string> = {}): Promise<AmenityReservation[]> => {
    const { data } = await api.get('/amenity-reservations/', { params: { ...params, page_size: '500' } })
    return data.results ?? data
  },
  create: async (payload: Partial<AmenityReservation>): Promise<AmenityReservation> => {
    const { data } = await api.post('/amenity-reservations/', payload)
    return data
  },
  update: async (id: number, payload: Partial<AmenityReservation>): Promise<AmenityReservation> => {
    const { data } = await api.patch(`/amenity-reservations/${id}/`, payload)
    return data
  },
  remove: async (id: number) => api.delete(`/amenity-reservations/${id}/`),
  bulkDelete: async (ids: number[]): Promise<{ count: number; skipped: number[] }> => {
    const { data } = await api.post('/amenity-reservations/bulk_delete/', { ids })
    return data
  },
  stats: async (params: Record<string, string> = {}): Promise<AmenityStats> => {
    const { data } = await api.get('/amenity-reservations/stats/', { params })
    return data
  },
}

export const menuItemApi = {
  list: async (params?: Record<string, string>): Promise<MenuItem[]> => {
    const { data } = await api.get('/menu-items/', { params: { ...params, page_size: '200' } })
    return data.results ?? data
  },
  create: async (payload: Partial<MenuItem>): Promise<MenuItem> => {
    const { data } = await api.post('/menu-items/', payload)
    return data
  },
  update: async (id: number, payload: Partial<MenuItem>): Promise<MenuItem> => {
    const { data } = await api.patch(`/menu-items/${id}/`, payload)
    return data
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/menu-items/${id}/`)
  },
}
