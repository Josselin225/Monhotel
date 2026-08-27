import api from './client'

export interface CleaningTask {
  id: number
  room: number
  room_number: string
  room_type: string
  floor: number
  booking: number | null
  booking_ref: string | null
  assigned_to: number | null
  assigned_to_name: string | null
  status: 'pending' | 'in_progress' | 'done' | 'inspected'
  status_display: string
  priority: 'normal' | 'urgent'
  priority_display: string
  notes: string
  scheduled_for: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface CleaningStats {
  pending: number
  in_progress: number
  done: number
  inspected: number
}

export const housekeepingApi = {
  list: async (params?: Record<string, string>) => {
    const { data } = await api.get('/housekeeping/', { params })
    return Array.isArray(data) ? { results: data, count: data.length } : data
  },
  stats: async (): Promise<CleaningStats> => {
    const { data } = await api.get('/housekeeping/stats/')
    return data
  },
  start: async (id: number): Promise<CleaningTask> => {
    const { data } = await api.post(`/housekeeping/${id}/start/`)
    return data
  },
  complete: async (id: number): Promise<CleaningTask> => {
    const { data } = await api.post(`/housekeeping/${id}/complete/`)
    return data
  },
  inspect: async (id: number): Promise<CleaningTask> => {
    const { data } = await api.post(`/housekeeping/${id}/inspect/`)
    return data
  },
  assign: async (id: number, userId: number | null): Promise<CleaningTask> => {
    const { data } = await api.post(`/housekeeping/${id}/assign/`, { user_id: userId })
    return data
  },
  create: async (payload: Partial<CleaningTask>): Promise<CleaningTask> => {
    const { data } = await api.post('/housekeeping/', payload)
    return data
  },
  delete: async (id: number) => api.delete(`/housekeeping/${id}/`),
  sync: async (): Promise<{ created: number; detail: string }> => {
    const { data } = await api.post('/housekeeping/sync/')
    return data
  },
}
