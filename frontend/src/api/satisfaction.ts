import api from './client'
import axios from 'axios'

export interface Survey {
  id: number
  booking: number
  booking_ref: string
  client_name: string
  token: string
  is_submitted: boolean
  submitted_at: string | null
  average_score: number | null
  score_overall: number | null
  score_cleanliness: number | null
  score_service: number | null
  score_comfort: number | null
  score_value: number | null
  comment: string
  would_return: boolean | null
  created_at: string
  reminder_sent_at: string | null
}

export interface SurveyStats {
  total: number
  pending: number
  would_return_pct: number | null
  scores: {
    overall: number | null
    cleanliness: number | null
    service: number | null
    comfort: number | null
    value: number | null
  }
}

const PUBLIC_BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`

export const satisfactionApi = {
  list: async (params?: Record<string, string>) => {
    const { data } = await api.get<{ results: Survey[]; count: number }>('/surveys/', { params })
    return data
  },
  create: async (bookingId: number) => {
    const { data } = await api.post<Survey>('/surveys/', { booking: bookingId })
    return data
  },
  sendSurvey: async (id: number) => {
    const { data } = await api.post(`/surveys/${id}/send_survey/`)
    return data
  },
  sendReminder: async (id: number) => {
    const { data } = await api.post(`/surveys/${id}/send_reminder/`)
    return data
  },
  stats: async (): Promise<SurveyStats> => {
    const { data } = await api.get('/surveys/stats/')
    return data
  },

  // Public endpoints (no auth required)
  getTestimonials: async (): Promise<{
    author: string; score_overall: number; text: string
    would_return: boolean | null; submitted_at: string
  }[]> => {
    const { data } = await axios.get(`${PUBLIC_BASE}/surveys/testimonials/`)
    return data
  },
  getPublic: async (token: string) => {
    const { data } = await axios.get(`${PUBLIC_BASE}/surveys/respond/${token}/`)
    return data as { is_submitted: boolean; booking_ref: string; client_name: string; check_in: string; check_out: string }
  },
  submit: async (token: string, payload: Partial<Survey>) => {
    const { data } = await axios.post(`${PUBLIC_BASE}/surveys/respond/${token}/`, payload)
    return data
  },
}
