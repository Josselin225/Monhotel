import axios from 'axios'
import api from './client'

const PUBLIC_BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api`

// Clé de session anonyme, réinitialisée à chaque fermeture d'onglet
let _sk = sessionStorage.getItem('_sk') ?? ''
if (!_sk) {
  _sk = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  sessionStorage.setItem('_sk', _sk)
}

export interface DailyVisit {
  date: string
  visits: number
  unique: number
}

export interface VisitStats {
  last_30_days: { visits: number; unique: number }
  last_90_days: { visits: number; unique: number }
  daily: DailyVisit[]
  referrers: { referrer: string; count: number }[]
}

export const trackingApi = {
  track: (path: string, referrer = '') => {
    axios.post(`${PUBLIC_BASE}/visits/track/`, {
      path,
      session_key: _sk,
      referrer: referrer.slice(0, 500),
    }).catch(() => {})
  },

  getStats: async (): Promise<VisitStats> => {
    const { data } = await api.get<VisitStats>('/visits/stats/')
    return data
  },
}
