import api from './client'
import { Room, RoomType, PaginatedResponse } from '../types'

export interface PricingRule {
  id: number
  name: string
  rule_type: string
  rule_type_display: string
  room_type: number | null
  room_type_name: string | null
  is_active: boolean
  percent_change: string
  date_start: string | null
  date_end: string | null
  days_threshold: number | null
  occupancy_threshold: number | null
  priority: number
  created_at: string
}

export interface PriceCalculation {
  base_price: number
  price_per_night: number
  multiplier: number
  applied_rules: string[]
  occupancy_pct: number | null
  nights: number
  total_price: number
}

export const roomsApi = {
  list: async (params?: Record<string, string>) => {
    const { data } = await api.get<PaginatedResponse<Room>>('/rooms/', { params })
    return data
  },
  get: async (id: number) => {
    const { data } = await api.get<Room>(`/rooms/${id}/`)
    return data
  },
  create: async (payload: Partial<Room>) => {
    const { data } = await api.post<Room>('/rooms/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Room>) => {
    const { data } = await api.patch<Room>(`/rooms/${id}/`, payload)
    return data
  },
  delete: async (id: number) => api.delete(`/rooms/${id}/`),

  listTypes: async () => {
    const { data } = await api.get<PaginatedResponse<RoomType>>('/room-types/')
    return data
  },
  createType: async (payload: Partial<RoomType>) => {
    const { data } = await api.post<RoomType>('/room-types/', payload)
    return data
  },
  updateType: async (id: number, payload: Partial<RoomType>) => {
    const { data } = await api.patch<RoomType>(`/room-types/${id}/`, payload)
    return data
  },
  deleteType: async (id: number) => api.delete(`/room-types/${id}/`),

  listPricingRules: async (params?: Record<string, string>) => {
    const { data } = await api.get<PaginatedResponse<PricingRule>>('/pricing-rules/', { params })
    return data
  },
  createPricingRule: async (payload: Partial<PricingRule>) => {
    const { data } = await api.post<PricingRule>('/pricing-rules/', payload)
    return data
  },
  updatePricingRule: async (id: number, payload: Partial<PricingRule>) => {
    const { data } = await api.patch<PricingRule>(`/pricing-rules/${id}/`, payload)
    return data
  },
  deletePricingRule: async (id: number) => api.delete(`/pricing-rules/${id}/`),

  calculatePrice: async (roomId: number, checkIn: string, checkOut: string): Promise<PriceCalculation> => {
    const { data } = await api.get<PriceCalculation>('/pricing-rules/calculate/', {
      params: { room: roomId, check_in: checkIn, check_out: checkOut },
    })
    return data
  },
}
