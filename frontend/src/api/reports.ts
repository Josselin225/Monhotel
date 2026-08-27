import api from './client'

// ── Monthly report ────────────────────────────────────────────────────────

export interface ReportPeriod {
  year: number; month: number; label: string
}

export interface BookingsReport {
  total: number; confirmed: number; checked_in: number; checked_out: number
  cancelled: number; no_show: number; revenue: number; nights_sold: number
  adr: number; occupancy: number; revpar: number; total_rooms: number
  sources: { source: string; label: string; count: number }[]
}

export interface FinancesReport {
  income: number; expense: number; net: number
  by_category: Record<string, { label: string; income: number; expense: number }>
}

export interface SatisfactionReport {
  count: number; avg_overall: number | null; avg_cleanliness: number | null
  avg_service: number | null; avg_comfort: number | null; avg_value: number | null
  would_return_pct: number
}

export interface MaintenanceReport {
  total: number; open: number; resolved: number; cost: number
  by_priority: { key: string; label: string; count: number }[]
  by_category: { key: string; label: string; count: number }[]
}

export interface HousekeepingReport {
  total: number; done: number; pending: number; completion_rate: number
}

export interface MonthlyReport {
  period: ReportPeriod
  bookings: BookingsReport
  finances: FinancesReport
  satisfaction: SatisfactionReport
  maintenance: MaintenanceReport
  housekeeping: HousekeepingReport
}

// ── Full report ───────────────────────────────────────────────────────────

export interface RoomEntry {
  id: number; number: string; type: string; floor: number; floor_label: string
  status: string; status_label: string; base_price: number
  current_guest?: string; check_out?: string
}

export interface FloorSummary {
  floor: number; label: string; total: number
  available: number; occupied: number; maintenance: number; cleaning: number; other: number
}

export interface RoomsSection {
  total: number; available: number; occupied: number; maintenance: number
  cleaning: number; occupancy_pct: number
  by_floor: FloorSummary[]; list: RoomEntry[]
}

export interface ConcludedBooking {
  reference: string; client_name: string; client_id: number; vip_status: string
  room_number: string; room_type: string; check_in: string; check_out: string
  nights: number; total_price: number; source: string
}

export interface ConcludedSection {
  total: number; revenue: number; avg_stay: number; list: ConcludedBooking[]
}

export interface VipClient {
  id: number; name: string; email: string; phone: string; vip_status: string
  nationality: string; preferences: string; total_stays: number; total_spent: number
  last_stay: string | null; last_room: string | null; stayed_this_period: boolean
}

export interface VipSection {
  vip_count: number; vvip_count: number; list: VipClient[]
}

export interface IncomeCat {
  key: string; label: string; amount: number; pct: number
}

export interface ExpenseCat {
  key: string; label: string; amount: number; pct: number
  budget: number | null; budget_pct: number | null; over_budget: boolean
}

export interface PaymentMethod {
  method: string; label: string; amount: number; pct: number
}

export interface TopTransaction {
  reference: string; type: string; label: string; amount: number
  date: string; description: string; payment_method: string
}

export interface InvoiceStats {
  total: number; paid: number; draft: number; issued: number; cancelled: number
  total_amount: number; paid_amount: number
}

export interface DailyPoint { date: string; amount: number }

export interface FullFinances {
  income: number; expense: number; net: number
  income_by_category: IncomeCat[]
  expense_by_category: ExpenseCat[]
  payment_methods: PaymentMethod[]
  top_transactions: TopTransaction[]
  invoices: InvoiceStats | null
  daily_curve: DailyPoint[]
}

export interface FullMaintenanceReport extends MaintenanceReport {
  urgent_open: { reference: string; title: string; category: string }[]
}

export interface FullReport {
  period: ReportPeriod
  rooms: RoomsSection
  concluded: ConcludedSection
  vip: VipSection
  finances: FullFinances
  satisfaction: SatisfactionReport
  maintenance: FullMaintenanceReport
  housekeeping: HousekeepingReport
}

// ── API calls ─────────────────────────────────────────────────────────────

export const reportsApi = {
  monthly: (year: number, month: number): Promise<MonthlyReport> =>
    api.get('/reports/monthly/', { params: { year, month } }).then((r: { data: MonthlyReport }) => r.data),

  full: (year: number, month: number): Promise<FullReport> =>
    api.get('/reports/full/', { params: { year, month } }).then((r: { data: FullReport }) => r.data),
}
