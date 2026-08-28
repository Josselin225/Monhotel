import api from './client'

export interface Employee {
  id: number
  name: string
  position: string
  position_display: string
  phone: string
  email: string
  notes: string
  is_active: boolean
  user: number | null
  user_username: string | null
  shifts_count: number
  created_at: string
}

export interface Shift {
  id: number
  employee: number
  employee_name: string
  date: string
  start_time: string
  end_time: string
  position: string
  position_display: string
  notes: string
  hours: number
  created_by: number | null
  created_at: string
}

export interface ShiftSummary {
  employee: number
  employee_name: string
  hours: number
}

export const POSITIONS = [
  { value: 'reception',    label: 'Réception' },
  { value: 'housekeeping', label: 'Ménage' },
  { value: 'maintenance',  label: 'Maintenance' },
  { value: 'restaurant',   label: 'Restauration' },
  { value: 'management',   label: 'Direction' },
  { value: 'security',     label: 'Sécurité' },
  { value: 'other',        label: 'Autre' },
]

export interface CreateAccountPayload {
  username: string
  first_name: string
  last_name: string
  email: string
  phone: string
  role: string
  password: string
}

export const employeeApi = {
  list: async (params?: Record<string, string>): Promise<Employee[]> => {
    const { data } = await api.get('/employees/', { params: { ...params, page_size: '500' } })
    return data.results ?? data
  },
  create: async (payload: Partial<Employee>): Promise<Employee> => {
    const { data } = await api.post('/employees/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Employee>): Promise<Employee> => {
    const { data } = await api.patch(`/employees/${id}/`, payload)
    return data
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/employees/${id}/`)
  },
  createAccount: async (id: number, payload: CreateAccountPayload): Promise<Employee> => {
    const { data } = await api.post(`/employees/${id}/create_account/`, payload)
    return data
  },
}

export const schedulingApi = {
  list: async (params: Record<string, string> = {}): Promise<Shift[]> => {
    const { data } = await api.get('/shifts/', { params: { ...params, page_size: '500' } })
    return data.results ?? data
  },
  create: async (payload: Partial<Shift>) => {
    const { data } = await api.post<Shift>('/shifts/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Shift>) => {
    const { data } = await api.patch<Shift>(`/shifts/${id}/`, payload)
    return data
  },
  remove: async (id: number) => api.delete(`/shifts/${id}/`),
  mine: async (): Promise<Shift[]> => {
    const { data } = await api.get('/shifts/mine/')
    return data
  },
  summary: async (params: Record<string, string> = {}): Promise<ShiftSummary[]> => {
    const { data } = await api.get('/shifts/summary/', { params })
    return data
  },
  downloadPdf: async (params: Record<string, string>): Promise<Blob> => {
    const { data } = await api.get('/shifts/pdf/', { params, responseType: 'blob' })
    return data
  },
}
