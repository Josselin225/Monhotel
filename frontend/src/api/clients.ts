import api from './client'
import { Client, ClientNote, CRMStats, PaginatedResponse } from '../types'

export const clientsApi = {
  list: async (params?: Record<string, string>) => {
    const { data } = await api.get<PaginatedResponse<Client>>('/clients/', { params })
    return data
  },
  get: async (id: number) => {
    const { data } = await api.get<Client>(`/clients/${id}/`)
    return data
  },
  create: async (payload: Partial<Client>) => {
    const { data } = await api.post<Client>('/clients/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Client>) => {
    const { data } = await api.patch<Client>(`/clients/${id}/`, payload)
    return data
  },
  delete: async (id: number) => api.delete(`/clients/${id}/`),
  toggleBlacklist: async (id: number, reason?: string): Promise<Client> => {
    const { data } = await api.post<Client>(`/clients/${id}/toggle_blacklist/`, { reason })
    return data
  },
  importCsv: async (file: File): Promise<{ created: number; skipped: number; errors: string[] }> => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post('/clients/import_csv/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    return data
  },
  exportCsv: async (): Promise<Blob> => {
    const { data } = await api.get('/clients/export_csv/', { responseType: 'blob' })
    return data
  },
  exportXlsx: async (): Promise<Blob> => {
    const { data } = await api.get('/clients/export_xlsx/', { responseType: 'blob' })
    return data
  },
  stats: async (): Promise<CRMStats> => {
    const { data } = await api.get<CRMStats>('/clients/stats/')
    return data
  },

  // Notes
  listNotes: async (clientId: number): Promise<ClientNote[]> => {
    const { data } = await api.get(`/clients/${clientId}/notes/`)
    return Array.isArray(data) ? data : data.results
  },
  createNote: async (clientId: number, payload: { note_type: string; content: string }): Promise<ClientNote> => {
    const { data } = await api.post(`/clients/${clientId}/notes/`, payload)
    return data
  },
  deleteNote: async (clientId: number, noteId: number): Promise<void> => {
    await api.delete(`/clients/${clientId}/notes/${noteId}/`)
  },
}
