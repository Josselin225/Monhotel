import axios from 'axios'

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

export interface PublicRoomType {
  id: number
  name: string
  description: string
  base_price: string
  capacity: number
  amenities: string[]
  available_count: number
  total_count: number
}

export interface BookingConfirmation {
  reference: string
  room_number: string
  room_type: string
  check_in: string
  check_out: string
  nights: number
  total_price: string
  price_per_night: string
  payment_method: 'on_site' | 'transfer'
}

export interface PublicBookingInput {
  check_in: string
  check_out: string
  room_type_id: number
  first_name: string
  last_name: string
  phone: string
  email?: string
  adults?: number
  children?: number
  special_requests?: string
  payment_method?: 'on_site' | 'transfer'
}

export async function getAvailableRooms(check_in: string, check_out: string): Promise<PublicRoomType[]> {
  const { data } = await publicApi.get('/public/available-rooms/', { params: { check_in, check_out } })
  return data
}

export async function createPublicBooking(booking: PublicBookingInput): Promise<BookingConfirmation> {
  const { data } = await publicApi.post('/public/book/', booking)
  return data
}

export interface CalendarDay {
  date: string
  day: number
  weekday: number
  available: number
  total: number
  past: boolean
}

export interface AvailabilityCalendar {
  year: number
  month: number
  days: CalendarDay[]
  total_rooms: number
}

export async function getAvailabilityCalendar(year: number, month: number): Promise<AvailabilityCalendar> {
  const { data } = await publicApi.get('/public/calendar/', { params: { year, month } })
  return data
}

// ── Portail self-service : gérer sa réservation (référence + contact) ──────

export interface MyBooking {
  reference: string
  status: string
  status_display: string
  room_number: string
  room_type: string
  check_in: string
  check_out: string
  nights: number
  adults: number
  children: number
  total_price: string
  payment_method: 'on_site' | 'transfer'
  deposit: string
  deposit_paid: boolean
  special_requests: string
  can_cancel: boolean
  can_edit: boolean
  has_invoice: boolean
}

export async function lookupMyBooking(reference: string, contact: string): Promise<MyBooking> {
  const { data } = await publicApi.post('/public/my-booking/', { reference, contact })
  return data
}

export async function updateMyBooking(reference: string, contact: string, special_requests: string): Promise<MyBooking> {
  const { data } = await publicApi.patch(`/public/my-booking/${reference}/`, { contact, special_requests })
  return data
}

export async function cancelMyBooking(reference: string, contact: string): Promise<MyBooking> {
  const { data } = await publicApi.post(`/public/my-booking/${reference}/cancel/`, { contact })
  return data
}

export function myBookingInvoiceUrl(reference: string, contact: string): string {
  const base = import.meta.env.VITE_API_URL || '/api'
  return `${base}/public/my-booking/${reference}/invoice/?contact=${encodeURIComponent(contact)}`
}
