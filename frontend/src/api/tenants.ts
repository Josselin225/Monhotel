import api from './client'
import { PaginatedResponse } from '../types'

export interface Hotel {
  id: number
  name: string
  slug: string
  email: string
  phone: string
  city: string
  country: string
  plan: 'basic' | 'pro' | 'enterprise'
  is_active: boolean
  trial_ends_at: string | null
  created_at: string
  users_count: number
  rooms_count: number
  bookings_count: number
  revenue_total: number
}

export const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export const tenantsApi = {
  listHotels: async (): Promise<Hotel[]> => {
    const { data } = await api.get<PaginatedResponse<Hotel>>('/hotels/', { params: { page_size: '200' } })
    return data.results
  },
  updateHotel: async (id: number, payload: Partial<Hotel>) => {
    const { data } = await api.patch<Hotel>(`/hotels/${id}/`, payload)
    return data
  },
}
