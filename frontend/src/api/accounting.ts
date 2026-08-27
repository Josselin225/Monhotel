import api from './client'

export interface Transaction {
  id: number
  reference: string
  type: 'income' | 'expense'
  type_display: string
  category: string
  category_display: string
  amount: string
  date: string
  description: string
  payment_method: string
  payment_method_display: string
  booking: number | null
  booking_reference: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface MonthlyStat {
  month: string
  month_short: string
  year: number
  income: string
  expense: string
  net: string
}

export interface AccountingSummary {
  income: string
  expense: string
  net: string
  by_category: Record<string, { total: string; type: string }>
  date_from: string | null
  date_to: string | null
}

export const INCOME_CATEGORIES = [
  { value: 'room_revenue', label: 'Revenus chambres' },
  { value: 'deposit',      label: 'Acomptes encaissés' },
  { value: 'extra',        label: 'Services extra' },
  { value: 'other_income', label: 'Autres recettes' },
]

export const EXPENSE_CATEGORIES = [
  { value: 'staff',         label: 'Personnel' },
  { value: 'maintenance',   label: 'Maintenance' },
  { value: 'supplies',      label: 'Fournitures' },
  { value: 'utilities',     label: 'Charges & Fluides' },
  { value: 'marketing',     label: 'Marketing' },
  { value: 'taxes',         label: 'Impôts & Taxes' },
  { value: 'other_expense', label: 'Autres dépenses' },
]

export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]

export const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Espèces' },
  { value: 'card',     label: 'Carte bancaire' },
  { value: 'mobile',   label: 'Mobile Money' },
  { value: 'transfer', label: 'Virement' },
  { value: 'other',    label: 'Autre' },
]

export interface Budget {
  id: number
  category: string
  category_display: string
  period: string
  period_display: string
  amount: string
  year: number
  month: number | null
  alert_pct: number
  notes: string
  created_at: string
  updated_at: string
  // from with_actuals
  spent?: number
  pct?: number
  alert?: boolean
  over?: boolean
  remaining?: number
}

export const accountingApi = {
  list: async (params?: Record<string, string>) => {
    const { data } = await api.get<{ results: Transaction[]; count: number }>('/accounting/transactions/', { params })
    return data
  },
  create: async (payload: Partial<Transaction>) => {
    const { data } = await api.post<Transaction>('/accounting/transactions/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Transaction>) => {
    const { data } = await api.patch<Transaction>(`/accounting/transactions/${id}/`, payload)
    return data
  },
  delete: async (id: number) => api.delete(`/accounting/transactions/${id}/`),

  summary: async (params?: Record<string, string>): Promise<AccountingSummary> => {
    const { data } = await api.get('/accounting/transactions/summary/', { params })
    return data
  },
  monthly: async (): Promise<MonthlyStat[]> => {
    const { data } = await api.get('/accounting/transactions/monthly/')
    return data
  },
  exportCsv: async (params?: Record<string, string>) => {
    const { data } = await api.get('/accounting/transactions/export_csv/', {
      params,
      responseType: 'blob',
    })
    return data as Blob
  },
  exportXlsx: async (params?: Record<string, string>) => {
    const { data } = await api.get('/accounting/transactions/export_xlsx/', {
      params,
      responseType: 'blob',
    })
    return data as Blob
  },
  importCsv: async (file: File): Promise<{ created: number; skipped: number; errors: string[] }> => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post('/accounting/transactions/import_csv/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  // Budget endpoints
  listBudgets: async (params?: Record<string, string>): Promise<Budget[]> => {
    const { data } = await api.get('/accounting/budgets/', { params })
    return Array.isArray(data) ? data : data.results ?? []
  },
  getBudgetsWithActuals: async (year: number, month: number): Promise<Budget[]> => {
    const { data } = await api.get('/accounting/budgets/with_actuals/', { params: { year: String(year), month: String(month) } })
    return data
  },
  createBudget: async (payload: Partial<Budget>): Promise<Budget> => {
    const { data } = await api.post('/accounting/budgets/', payload)
    return data
  },
  updateBudget: async (id: number, payload: Partial<Budget>): Promise<Budget> => {
    const { data } = await api.patch(`/accounting/budgets/${id}/`, payload)
    return data
  },
  deleteBudget: async (id: number): Promise<void> => {
    await api.delete(`/accounting/budgets/${id}/`)
  },
}
