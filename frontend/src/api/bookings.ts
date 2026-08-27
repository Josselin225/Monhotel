import api from './client'
import { Booking, BookingStats, PaginatedResponse } from '../types'

export interface DailyBooking {
  id: number
  reference: string
  client: string
  room_number: string
  room_type: string
  check_in: string
  check_out: string
  nights: number
  status: string
}

export interface ExtraService {
  id: number
  booking: number
  category: string
  category_display: string
  description: string
  amount: string
  quantity: number
  total: string
  date: string
  created_at: string
}

export interface CalendarRoom {
  room_id: number
  room_number: string
  room_type: string
  floor: number
  status: string
  bookings: {
    id: number
    reference: string
    client: string
    check_in: string
    check_out: string
    status: string
    nights: number
  }[]
}

export interface CalendarData {
  start: string
  end: string
  rooms: CalendarRoom[]
}

export interface Notifications {
  arrivals: { id: number; reference: string; client: string; room: string; status: string }[]
  departures: { id: number; reference: string; client: string; room: string; status: string }[]
  count: number
}

export const bookingsApi = {
  list: async (params?: Record<string, string>) => {
    const { data } = await api.get<PaginatedResponse<Booking>>('/bookings/', { params })
    return data
  },
  get: async (id: number) => {
    const { data } = await api.get<Booking>(`/bookings/${id}/`)
    return data
  },
  create: async (payload: Partial<Booking>) => {
    const { data } = await api.post<Booking>('/bookings/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Booking>) => {
    const { data } = await api.patch<Booking>(`/bookings/${id}/`, payload)
    return data
  },
  delete: async (id: number) => api.delete(`/bookings/${id}/`),
  stats: async (): Promise<BookingStats> => {
    const { data } = await api.get('/bookings/stats/')
    return data
  },
  calendar: async (start: string, end: string): Promise<CalendarData> => {
    const { data } = await api.get('/bookings/calendar/', { params: { start, end } })
    return data
  },
  notifications: async (): Promise<Notifications> => {
    const { data } = await api.get('/bookings/notifications/')
    return data
  },
  checkIn: async (id: number) => {
    const { data } = await api.post<Booking>(`/bookings/${id}/check_in/`)
    return data
  },
  checkOut: async (id: number) => {
    const { data } = await api.post<Booking>(`/bookings/${id}/check_out/`)
    return data
  },
  exportCsv: async (): Promise<Blob> => {
    const { data } = await api.get('/bookings/export_csv/', { responseType: 'blob' })
    return data
  },
  exportXlsx: async (): Promise<Blob> => {
    const { data } = await api.get('/bookings/export_xlsx/', { responseType: 'blob' })
    return data
  },
  analytics: async (params?: Record<string, string>) => {
    const { data } = await api.get('/bookings/analytics/', { params })
    return data
  },
  payDeposit: async (id: number) => {
    const { data } = await api.post<import('../types').Booking>(`/bookings/${id}/pay_deposit/`)
    return data
  },
  listExtras: async (bookingId: number): Promise<ExtraService[]> => {
    const { data } = await api.get(`/bookings/${bookingId}/extras/`)
    return data
  },
  addExtra: async (bookingId: number, payload: Partial<ExtraService>): Promise<ExtraService> => {
    const { data } = await api.post(`/bookings/${bookingId}/add_extra/`, payload)
    return data
  },
  deleteExtra: async (bookingId: number, extraId: number): Promise<void> => {
    await api.delete(`/bookings/${bookingId}/extras/${extraId}/`)
  },
  dailyReport: async (date?: string) => {
    const { data } = await api.get('/bookings/daily_report/', { params: date ? { date } : {} })
    return data as {
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
  },
  bulkAction: async (ids: number[], action: string): Promise<{ count: number } | Blob> => {
    if (action === 'export') {
      const { data } = await api.post('/bookings/bulk_action/', { ids, action }, { responseType: 'blob' })
      return data
    }
    const { data } = await api.post('/bookings/bulk_action/', { ids, action })
    return data
  },
}
