import api from './client'
import { PaginatedResponse } from '../types'

export interface AuditEntry {
  id: number
  user: number | null
  username: string
  action: string
  action_display: string
  model_name: string
  object_id: string
  object_repr: string
  description: string
  ip_address: string | null
  changes: Record<string, [unknown, unknown] | unknown>
  created_at: string
}

export const ACTION_COLORS: Record<string, string> = {
  create: 'text-green-700 bg-green-50 border-green-200',
  update: 'text-blue-700 bg-blue-50 border-blue-200',
  delete: 'text-red-700 bg-red-50 border-red-200',
  login:  'text-violet-700 bg-violet-50 border-violet-200',
  logout: 'text-gray-600 bg-gray-100 border-gray-200',
  view:   'text-amber-700 bg-amber-50 border-amber-200',
  other:  'text-gray-600 bg-gray-100 border-gray-200',
}

export const MODEL_NAMES = [
  'Hôtel', 'Utilisateur',
  'Chambre', 'Type de chambre', 'Règle tarifaire',
  'Client', 'Note client',
  'Réservation', 'Service extra',
  'Facture', 'Paiement', 'Transaction', 'Budget',
  'Contenu du site',
  'Tâche de ménage', 'Questionnaire satisfaction',
  'Technicien', 'Ticket maintenance',
  'Créneau personnel',
  'Catégorie de stock', 'Article de stock', 'Mouvement de stock',
]

export const auditLogApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<AuditEntry>> => {
    const { data } = await api.get('/audit-log/', { params })
    return data
  },
  exportUrl: (params: Record<string, string>): string => {
    const qs = new URLSearchParams(params).toString()
    const base = (api.defaults.baseURL || '').replace(/\/$/, '')
    return `${base}/audit-log/export/${qs ? `?${qs}` : ''}`
  },
  clear: async (): Promise<{ deleted: number }> => {
    const { data } = await api.post('/audit-log/clear/')
    return data
  },
  logView: async (label: string, path: string): Promise<void> => {
    await api.post('/audit-log/log-view/', { label, path })
  },
}
