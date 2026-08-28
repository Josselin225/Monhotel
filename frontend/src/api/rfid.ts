import api from './client'
import { PaginatedResponse } from '../types'

export interface RfidCard {
  id: number
  uid: string
  card_type: 'guest' | 'staff' | 'master'
  card_type_display: string
  status: 'active' | 'inactive' | 'lost'
  status_display: string
  is_valid_now: boolean
  booking: number | null
  booking_reference: string | null
  room: number | null
  room_number: string | null
  guest_name: string | null
  valid_from: string | null
  valid_until: string | null
  issued_by: number | null
  issued_by_name: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface IssueCardPayload {
  uid: string
  card_type?: 'guest' | 'staff' | 'master'
  booking?: number
  room?: number
  valid_from?: string
  valid_until?: string
  notes?: string
}

export interface AccessCheckResult {
  authorized: boolean
  reason: string
  card: RfidCard | null
}

export const CARD_TYPES = [
  { value: 'guest', label: 'Client' },
  { value: 'staff', label: 'Personnel' },
  { value: 'master', label: 'Passe général' },
]

export const rfidApi = {
  list: async (params?: Record<string, string>): Promise<RfidCard[]> => {
    const { data } = await api.get<PaginatedResponse<RfidCard>>('/rfid/cards/', { params: { page_size: '200', ...params } })
    return data.results ?? data
  },
  issue: async (payload: IssueCardPayload): Promise<RfidCard> => {
    const { data } = await api.post<RfidCard>('/rfid/cards/issue/', payload)
    return data
  },
  deactivate: async (id: number): Promise<RfidCard> => {
    const { data } = await api.post<RfidCard>(`/rfid/cards/${id}/deactivate/`)
    return data
  },
  markLost: async (id: number): Promise<RfidCard> => {
    const { data } = await api.post<RfidCard>(`/rfid/cards/${id}/mark_lost/`)
    return data
  },
  checkAccess: async (uid: string, room?: number): Promise<AccessCheckResult> => {
    const { data } = await api.post<AccessCheckResult>('/rfid/cards/check_access/', { uid, room })
    return data
  },
}
