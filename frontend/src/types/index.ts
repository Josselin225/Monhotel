export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'receptionist' | 'manager'
  role_display: string
  phone: string
  avatar?: string | null
  is_active: boolean
  two_factor_enabled: boolean
  is_superuser: boolean
}

export interface RoomType {
  id: number
  name: string
  description: string
  base_price: number
  hourly_rate: number | null
  capacity: number
  amenities: string[]
  rooms_count: number
}

export interface Room {
  id: number
  number: string
  room_type: number
  room_type_name: string
  floor: number
  floor_display: string
  status: 'available' | 'occupied' | 'maintenance' | 'cleaning'
  status_display: string
  price: number
  price_override: number | null
  notes: string
  image: string | null
}

export interface Client {
  id: number
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string
  nationality: string
  id_type: string
  id_number: string
  address: string
  notes: string
  is_blacklisted: boolean
  blacklist_reason: string
  vip_status: 'regular' | 'vip' | 'vvip'
  vip_status_display: string
  birthday: string | null
  preferences: string
  bookings_count: number
  total_nights: number
  lifetime_value: number
  last_stay_date: string | null
  created_at: string
}

export interface ClientNote {
  id: number
  client: number
  author: number | null
  author_name: string
  note_type: 'note' | 'call' | 'email' | 'complaint' | 'request' | 'visit'
  note_type_display: string
  content: string
  created_at: string
}

export interface CRMStats {
  total: number
  vip_count: number
  vvip_count: number
  new_this_month: number
  top_clients: { id: number; full_name: string; vip_status: string; lifetime_value: number; bookings_count: number }[]
  upcoming_birthdays: { id: number; full_name: string; birthday: string; days_until: number }[]
}

export interface Booking {
  id: number
  reference: string
  client: number
  client_detail: Client
  room: number
  room_detail: Room
  check_in: string
  check_out: string
  nights: number
  adults: number
  children: number
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
  status_display: string
  source: string
  source_display: string
  billing_type: 'nightly' | 'hourly'
  billing_type_display: string
  duration_label: string
  price_per_night: number
  hours: number | null
  price_per_hour: number | null
  total_price: number
  deposit: number
  deposit_paid_at: string | null
  deposit_paid: boolean
  payment_method: 'on_site' | 'transfer'
  payment_method_display: string
  special_requests: string
  notes: string
  extras: {
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
  }[]
  extras_total: string
  created_at: string
}

export interface Payment {
  id: number
  invoice: number
  amount: number
  method: string
  method_display: string
  reference: string
  note: string
  paid_at: string
  created_by: number | null
  created_at: string
}

export interface Invoice {
  id: number
  number: string
  booking: number
  booking_detail: Booking
  status: 'draft' | 'issued' | 'paid' | 'cancelled'
  status_display: string
  issued_at: string | null
  paid_at: string | null
  payment_method: string
  payment_method_display: string
  subtotal: number
  taxes: number
  total: number
  total_paid: number
  balance: number
  notes: string
  extra_services: { label: string; amount: number }[]
  payments: Payment[]
  created_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface BookingStats {
  total: number
  pending: number
  confirmed: number
  checked_in: number
  arrivals_today: number
  departures_today: number
  revenue_month: number
}

export interface InvoiceStats {
  total_revenue: number
  month_revenue: number
  pending_amount: number
  draft_count: number
  issued_count: number
  paid_count: number
}
