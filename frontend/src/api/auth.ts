import api from './client'
import { User } from '../types'

export interface LoginResponse {
  user?: User
  two_factor_required?: boolean
}

export interface AuditEntry {
  id: number
  username: string
  action: string
  action_display: string
  ip_address: string | null
  created_at: string
}

export const authApi = {
  login: async (username: string, password: string, otp_code?: string, backup_code?: string): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/login/', { username, password, otp_code, backup_code })
    // Le backend pose les cookies HttpOnly access_token et refresh_token
    // et retourne directement les données de l'utilisateur connecté —
    // sauf si la 2FA est activée et qu'aucun code n'a encore été fourni.
    if (data?.two_factor_required) return { two_factor_required: true }
    return { user: data }
  },

  setup2FA: async (): Promise<{ secret: string; qr_code: string }> => {
    const { data } = await api.post('/auth/2fa/setup/')
    return data
  },

  confirm2FA: async (code: string): Promise<{ backup_codes: string[] }> => {
    const { data } = await api.post('/auth/2fa/confirm/', { code })
    return data
  },

  disable2FA: async (password: string): Promise<void> => {
    await api.post('/auth/2fa/disable/', { password })
  },

  loginHistory: async (): Promise<AuditEntry[]> => {
    const { data } = await api.get('/auth/login-history/')
    return data
  },

  logout: async () => {
    // Le backend blackliste le refresh_token et supprime les cookies
    await api.post('/auth/logout/', {})
  },

  me: async (): Promise<User> => {
    const { data } = await api.get('/auth/me/')
    return data
  },

  updateMe: async (payload: { first_name?: string; last_name?: string; email?: string; phone?: string }): Promise<User> => {
    const { data } = await api.patch('/auth/me/', payload)
    return data
  },

  changePassword: async (old_password: string, new_password: string): Promise<void> => {
    await api.post('/auth/change-password/', { old_password, new_password })
  },

  updateAvatar: async (file: File): Promise<User> => {
    const form = new FormData()
    form.append('avatar', file)
    const { data } = await api.patch('/auth/me/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  removeAvatar: async (): Promise<User> => {
    const form = new FormData()
    form.append('avatar', '')
    const { data } = await api.patch('/auth/me/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
}
