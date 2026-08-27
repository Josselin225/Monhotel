import api from './client'
import { PaginatedResponse } from '../types'

export interface Technician {
  id: number
  name: string
  phone: string
  email: string
  specialty: string
  specialty_display: string
  company: string
  notes: string
  is_active: boolean
  tickets_count: number
  created_at: string
}

export interface MaintenanceTicket {
  id: number
  reference: string
  room: number | null
  room_number: string | null
  location: string
  category: string
  category_display: string
  priority: string
  priority_display: string
  status: string
  status_display: string
  title: string
  description: string
  reported_by: number | null
  reported_by_name: string | null
  assigned_to: number | null
  assigned_to_name: string | null
  technician: number | null
  technician_name: string | null
  technician_phone: string | null
  technician_specialty: string | null
  cost: string | null
  resolved_at: string | null
  resolution_notes: string
  created_at: string
  updated_at: string
}

export interface MaintenanceStats {
  total: number
  open: number
  in_progress: number
  resolved: number
  urgent: number
}

export const PRIORITY_COLORS: Record<string, string> = {
  low:    'text-gray-500 bg-gray-100 border-gray-200',
  medium: 'text-blue-600 bg-blue-50 border-blue-200',
  high:   'text-orange-600 bg-orange-50 border-orange-200',
  urgent: 'text-red-600 bg-red-50 border-red-200',
}

export const STATUS_COLORS: Record<string, string> = {
  open:        'text-amber-700 bg-amber-50 border-amber-200',
  in_progress: 'text-blue-700 bg-blue-50 border-blue-200',
  resolved:    'text-green-700 bg-green-50 border-green-200',
  closed:      'text-gray-500 bg-gray-100 border-gray-200',
}

export const CATEGORIES = [
  { value: 'plumbing',   label: 'Plomberie' },
  { value: 'electrical', label: 'Électricité' },
  { value: 'hvac',       label: 'Climatisation / Chauffage' },
  { value: 'furniture',  label: 'Mobilier' },
  { value: 'cleaning',   label: 'Nettoyage spécial' },
  { value: 'painting',   label: 'Peinture' },
  { value: 'it',         label: 'Informatique / TV' },
  { value: 'security',   label: 'Sécurité' },
  { value: 'other',      label: 'Autre' },
]

export const SPECIALTIES = [
  { value: 'plumbing',   label: 'Plomberie' },
  { value: 'electrical', label: 'Électricité' },
  { value: 'hvac',       label: 'Climatisation / Chauffage' },
  { value: 'furniture',  label: 'Mobilier' },
  { value: 'cleaning',   label: 'Nettoyage spécial' },
  { value: 'painting',   label: 'Peinture' },
  { value: 'it',         label: 'Informatique / TV' },
  { value: 'security',   label: 'Sécurité' },
  { value: 'general',    label: 'Général (tous corps d\'état)' },
  { value: 'other',      label: 'Autre' },
]

export const technicianApi = {
  list: async (params?: Record<string, string>): Promise<Technician[]> => {
    const { data } = await api.get('/maintenance/technicians/', { params })
    return Array.isArray(data) ? data : data.results
  },
  create: async (payload: Partial<Technician>): Promise<Technician> => {
    const { data } = await api.post('/maintenance/technicians/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Technician>): Promise<Technician> => {
    const { data } = await api.patch(`/maintenance/technicians/${id}/`, payload)
    return data
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/maintenance/technicians/${id}/`)
  },
}

export const maintenanceApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<MaintenanceTicket>> => {
    const { data } = await api.get('/maintenance/tickets/', { params })
    return data
  },
  get: async (id: number): Promise<MaintenanceTicket> => {
    const { data } = await api.get(`/maintenance/tickets/${id}/`)
    return data
  },
  create: async (payload: Partial<MaintenanceTicket>): Promise<MaintenanceTicket> => {
    const { data } = await api.post('/maintenance/tickets/', payload)
    return data
  },
  update: async (id: number, payload: Partial<MaintenanceTicket>): Promise<MaintenanceTicket> => {
    const { data } = await api.patch(`/maintenance/tickets/${id}/`, payload)
    return data
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/maintenance/tickets/${id}/`)
  },
  resolve: async (id: number, resolution_notes: string, cost?: number): Promise<MaintenanceTicket> => {
    const { data } = await api.post(`/maintenance/tickets/${id}/resolve/`, { resolution_notes, cost })
    return data
  },
  stats: async (): Promise<MaintenanceStats> => {
    const { data } = await api.get('/maintenance/tickets/stats/')
    return data
  },
}
